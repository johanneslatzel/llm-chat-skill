import { Dirent } from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

import type { ChatService } from '@johannes.latzel/llm-chat';
import { SkillRegistryConfiguration } from './config.js';
import { BodyFormat, Skill, SkillResource } from './skill.js';
import { normaliseName } from './helper.js';
/**
 * Manages loading, listing, and retrieving skills from a configured directory.
 *
 * Skills are defined in `SKILL.md` files with YAML frontmatter
 * (`name` and `description` required). Each skill lives in its own
 * subdirectory within the configured skill directory.
 *
 */
export class SkillRegistry {
    private readonly config: SkillRegistryConfiguration;
    private readonly skills: Map<string, Skill> = new Map();
    private service: ChatService | null = null;

    /**
     * @param config - Optional configuration. Falls back to
     *   `new SkillRegistryConfiguration()` when omitted.
     */
    constructor(config?: SkillRegistryConfiguration) {
        this.config = config ?? new SkillRegistryConfiguration();
    }

    /**
     * Scans the configured skill directory and loads all valid skills.
     *
     * Safe to call multiple times — subsequent calls re-load from disk.
     */
    async initialize(service?: ChatService | null): Promise<void> {
        this.service = service ?? null;
        if (!this.config.skillDir) return;
        const rootDir = this.config.skillDir;

        let entries: Dirent[];
        try {
            entries = await fsp.readdir(rootDir, { withFileTypes: true });
        } catch (e) {
            this.config.handleWarning(
                `Could not read skill directory ${rootDir} — ${(e as Error).message}`
            );
            return;
        }

        await Promise.all(
            entries
                .filter((e: Dirent) => e.isDirectory())
                .map(async (entry) => {
                    try {
                        const filePath = path.join(rootDir, entry.name, 'SKILL.md');
                        const content = await fsp.readFile(filePath, 'utf-8');
                        const skill = Skill.parse(content, rootDir);
                        if (!skill) {
                            throw new Error(
                                `Skipping ${entry.name}/SKILL.md: invalid or missing YAML frontmatter (name and description are required)`
                            );
                        }
                        skill.name = normaliseName(skill.name);
                        this.skills.set(skill.name, skill);
                    } catch (e) {
                        this.config.handleWarning((e as Error).message);
                    }
                })
        );

        await this.refreshPrompt();
    }

    private async refreshPrompt(): Promise<void> {
        if (this.service) {
            this.service
                .chat()
                .system()
                .prompt('skills')
                .setContent(await this.listing());
        }
    }

    private validateLength(label: string, length: number, min: number, max: number): void {
        if (length < min) {
            throw new Error(`${label} must be at least ${min} characters long (got ${length})`);
        }
        if (length > max) {
            throw new Error(`${label} must be at most ${max} characters long (got ${length})`);
        }
    }

    /**
     * Validates resource name and content length against the configured bounds.
     *
     * @throws {Error} When either value falls outside the allowed range.
     */
    validateResourceLengths(resourceName: string, content: string): void {
        this.validateLength(
            'Resource name',
            resourceName.length,
            this.config.resourceNameMinLength,
            this.config.resourceNameMaxLength
        );
        this.validateLength(
            'Resource content',
            content.length,
            this.config.resourceContentMinLength,
            this.config.resourceContentMaxLength
        );
    }

    /**
     * Returns all loaded skills.
     */
    list(): Skill[] {
        return Array.from(this.skills.values());
    }

    /**
     * Retrieves a skill by name.
     *
     * @param name - The skill name to look up.
     * @returns The skill instance, or `undefined` if not found.
     */
    get(name: string): Skill | undefined {
        const key = normaliseName(name);
        return this.skills.get(key);
    }

    // ── Mutation helpers ────────────────────────────────────────────

    /**
     * Creates a new skill on disk and registers it in memory.
     *
     * When `body` is empty the skill is created as a structured shell
     * (`body-format: structured`). Content is added later via
     * `set_skill_resource` with sections.
     *
     * @param name - Unique skill name.
     * @param description - Short description.
     * @param body - Full instructions (optional — empty = structured shell).
     * @returns The newly created skill.
     * @throws If a skill with this name is already registered, or if
     *   filesystem operations fail.
     */
    async createSkill(name: string, description: string, body: string): Promise<Skill> {
        name = normaliseName(name);
        this.validateLength(
            'Skill name',
            name.length,
            this.config.skillNameMinLength,
            this.config.skillNameMaxLength
        );
        this.validateLength(
            'Skill description',
            description.length,
            this.config.skillDescriptionMinLength,
            this.config.skillDescriptionMaxLength
        );

        const isStructured = body.length === 0;
        if (!isStructured) {
            this.validateLength(
                'Skill body',
                body.length,
                this.config.skillBodyMinLength,
                this.config.skillBodyMaxLength
            );
        }

        if (this.skills.has(name)) {
            throw new Error(`Skill '${name}' already exists`);
        }
        if (!this.config.skillDir) {
            throw new Error('Skill directory is not configured');
        }

        const skill = new Skill(name, description, body, this.config.skillDir);
        if (isStructured) {
            skill.metadataBodyFormat = BodyFormat.Structured;
        }

        try {
            await skill.save();
        } catch (e) {
            await skill.remove();
            throw e;
        }

        this.skills.set(name, skill);
        await this.refreshPrompt();
        return skill;
    }

    /**
     * Updates an existing skill's properties on disk and in memory.
     *
     * If `new_name` is provided, the skill's frontmatter name is changed
     * AND the subdirectory is renamed to match the new sanitized name.
     *
     * @param name - Current skill name.
     * @param updates - Fields to update (`new_name`, `description`, `body`).
     * @returns The updated skill.
     * @throws If the skill does not exist, or if filesystem operations fail.
     */
    async updateSkill(
        name: string,
        updates: { new_name?: string; description?: string; body?: string }
    ): Promise<Skill> {
        const key = normaliseName(name);
        const skill = this.skills.get(key);
        if (!skill) {
            throw new Error(`Skill '${name}' not found`);
        }

        if (updates.new_name && updates.new_name !== name) {
            const newName = normaliseName(updates.new_name);
            this.validateLength(
                'Skill name',
                newName.length,
                this.config.skillNameMinLength,
                this.config.skillNameMaxLength
            );
            this.skills.delete(name);
            await skill.rename(newName);
            this.skills.set(skill.name, skill);
        }

        if (updates.description !== undefined || updates.body !== undefined) {
            if (updates.body !== undefined && skill.isStructured) {
                throw new Error(
                    'Cannot directly set body on a structured skill. Use set_skill_resource with sections to modify individual sections.'
                );
            }

            const data: { description?: string; body?: string } = {};
            if (updates.description !== undefined) {
                this.validateLength(
                    'Skill description',
                    updates.description.length,
                    this.config.skillDescriptionMinLength,
                    this.config.skillDescriptionMaxLength
                );
                data.description = updates.description;
            }
            if (updates.body !== undefined) {
                this.validateLength(
                    'Skill body',
                    updates.body.length,
                    this.config.skillBodyMinLength,
                    this.config.skillBodyMaxLength
                );
                data.body = updates.body;
            }
            await skill.update(data);
        }

        await this.refreshPrompt();
        return skill;
    }

    /**
     * Deletes a skill from disk and removes it from the registry.
     *
     * @param name - The skill name to delete.
     * @throws If the skill does not exist.
     */
    async deleteSkill(name: string): Promise<void> {
        const key = normaliseName(name);
        const skill = this.skills.get(key);
        if (!skill) {
            throw new Error(`Skill '${name}' not found`);
        }

        this.skills.delete(key);
        await skill.remove();
        await this.refreshPrompt();
    }

    /**
     * Returns a human-readable listing of available skills.
     *
     * @returns A formatted string, or `''` when no skills are loaded.
     */
    async listing(): Promise<string> {
        const sorted = this.list().sort((a, b) => a.name.localeCompare(b.name));
        const lines: string[] = ['Available skills:'];
        const entries = await Promise.all(
            sorted.map(async (s) => {
                const resources = await s.listResources();
                const assets = resources.filter((r) => r.resource === SkillResource.Assets).length;
                const references = resources.filter(
                    (r) => r.resource === SkillResource.References
                ).length;
                const description = s.description.replace(/\n/g, ' ').trim();
                const parts: string[] = [
                    `    - ${s.name}:`,
                    `        - description: ${description}`,
                    `        - body-format: ${s.metadataBodyFormat}`
                ];
                if (s.tags.length > 0) {
                    parts.push(`        - tags: ${s.tags.join(', ')}`);
                }
                parts.push(`        - assets: ${assets}`);
                parts.push(`        - references: ${references}`);
                return parts.join('\n');
            })
        );
        for (const entry of entries) {
            lines.push(entry);
        }
        return lines.join('\n');
    }
}
