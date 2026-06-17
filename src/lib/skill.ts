import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import * as yaml from 'js-yaml';
import { normaliseName } from './helper.js';

/**
 * The resource directories allowed inside a skill's subdirectory.
 * `References` holds supporting documentation; `Assets` holds templates,
 * images, or other binary/text files; `Sections` holds the structured
 * body files for skills with `body-format: structured`.
 */
export enum SkillResource {
    Assets = 'assets',
    References = 'references',
    Sections = 'sections'
}

export enum BodyFormat {
    Plain = 'plain',
    Structured = 'structured'
}

/**
 * The ordered list of section files composing a structured skill's body.
 * Each entry maps a file name (under `sections/`) to its `##` heading.
 */
const SECTION_NAMES: { fileName: string; heading: string }[] = [
    { fileName: 'purpose.md', heading: 'Purpose' },
    { fileName: 'inputs-outputs.md', heading: 'Inputs / Outputs' },
    { fileName: 'constraints.md', heading: 'Constraints' },
    { fileName: 'workflow.md', heading: 'Workflow' },
    { fileName: 'decision-criteria.md', heading: 'Decision Criteria' },
    { fileName: 'examples.md', heading: 'Examples' },
    { fileName: 'anti-patterns.md', heading: 'Anti-Patterns' }
];

const VALID_SECTION_NAMES: ReadonlySet<string> = new Set(SECTION_NAMES.map((s) => s.fileName));

/**
 * Demotes all ATX headings in markdown by the given number of levels.
 * `######` headings are kept as-is since no deeper level is valid
 * markdown. Headings inside fenced code blocks are skipped.
 *
 * @param levels - Number of heading levels to add (default `1`).
 */
export function demoteHeadings(markdown: string, levels: number = 1): string {
    const lines = markdown.split('\n');
    const result: string[] = [];
    let inCodeBlock = false;

    for (const line of lines) {
        if (/^```/.test(line.trim())) {
            inCodeBlock = !inCodeBlock;
            result.push(line);
            continue;
        }

        if (!inCodeBlock) {
            const match = line.match(/^(#{1,6})\s/);
            if (match) {
                const hashes = match[1]!;
                const newLevel = Math.min(hashes.length + levels, 6);
                const demoted = '#'.repeat(newLevel);
                result.push(demoted + line.slice(hashes.length));
                continue;
            }
        }

        result.push(line);
    }

    return result.join('\n');
}

/**
 * Resolves a resource type and name against `skillDir`, validates the
 * resource type, and guards against path traversal.
 *
 * Returns `null` when the type is not valid, the name is empty, or the
 * resolved path escapes the resource subdirectory.
 */
function resolveResourcePath(
    skillDir: string,
    resourceType: string,
    name: string
): { resource: SkillResource; fileName: string; resolved: string } | null {
    if (!name) return null;

    let resource: SkillResource;
    if (resourceType === 'references') resource = SkillResource.References;
    else if (resourceType === 'assets') resource = SkillResource.Assets;
    else if (resourceType === 'sections') resource = SkillResource.Sections;
    else return null;

    const resolved = path.resolve(skillDir, resource, name);
    const resourcePrefix = path.join(skillDir, resource) + path.sep;
    if (!resolved.startsWith(resourcePrefix)) return null;
    return { resource, fileName: name, resolved };
}

/**
 * Represents a skill with its metadata, instructions, and filesystem operations.
 *
 * Each skill lives in a subdirectory of the configured skill directory,
 * named after the skill (sanitized). The subdirectory contains `SKILL.md`
 * (YAML frontmatter + markdown body), plus optional `references/`,
 * `assets/`, and `sections/` directories.
 */
export class Skill {
    /** Unique name used to identify the skill (e.g., `"my_skill"`). */
    name: string;
    /** Short description shown in listings. */
    description: string;
    /** Full instruction body (YAML frontmatter stripped). */
    body: string;
    /** Absolute path to the general skill directory containing skill subdirectories. */
    rootDir: string;
    /** Tags for categorisation (stored in `metadata.tags`). */
    tags: string[] = [];
    /** Whether this skill uses the structured sections/ format. */
    metadataBodyFormat: BodyFormat = BodyFormat.Plain;

    constructor(name: string, description: string, body: string, rootDir: string) {
        this.name = name;
        this.description = description;
        this.body = body;
        this.rootDir = rootDir;
    }

    /** True when the skill uses structured `sections/` files. */
    get isStructured(): boolean {
        return this.metadataBodyFormat === BodyFormat.Structured;
    }

    /** Sanitized directory name derived from the skill name. */
    get dirName(): string {
        return Skill.nameToDirName(this.name);
    }

    /** Absolute path to the skill's own subdirectory (derived from name). */
    get skillDir(): string {
        return path.join(this.rootDir, this.dirName);
    }

    /** Returns the sanitized directory name for a given skill name. */
    static nameToDirName(name: string): string {
        return normaliseName(name);
    }

    /** Serializes the skill to SKILL.md format (YAML frontmatter + body). */
    serialize(): string {
        const frontmatter: Record<string, unknown> = {
            name: this.name,
            description: this.description
        };

        const metadata: Record<string, unknown> = {};
        if (this.tags.length > 0) {
            metadata.tags = this.tags;
        }
        if (this.metadataBodyFormat === BodyFormat.Structured) {
            metadata['body-format'] = 'structured';
        }
        if (Object.keys(metadata).length > 0) {
            frontmatter.metadata = metadata;
        }

        const cleanYaml = yaml
            .dump(frontmatter, { lineWidth: -1, noCompatMode: true })
            .replace(/\n$/, '');

        let result = `---\n${cleanYaml}\n---`;
        if (this.body) {
            result += `\n\n${this.body}\n`;
        } else {
            result += '\n';
        }
        return result;
    }

    /**
     * Ensures the skill's subdirectory exists and writes SKILL.md to disk.
     * Safe to call for both creation and subsequent updates.
     */
    async save(): Promise<void> {
        await fsp.mkdir(this.skillDir, { recursive: true });
        await fsp.writeFile(path.join(this.skillDir, 'SKILL.md'), this.serialize(), 'utf-8');
    }

    /** Removes the entire skill subdirectory (SKILL.md, references/, assets/) from disk. */
    async remove(): Promise<void> {
        if (existsSync(this.skillDir)) {
            await fsp.rm(this.skillDir, { recursive: true, force: true });
        }
    }

    /**
     * Renames the skill on disk and updates in-memory properties.
     *
     * The subdirectory is renamed to match the new sanitized name and
     * `SKILL.md` is rewritten with the new name. The `rootDir` (general
     * skill directory) stays the same.
     */
    async rename(newName: string): Promise<void> {
        const oldDir = this.skillDir;
        this.name = newName;
        const newDir = this.skillDir;

        if (oldDir !== newDir && existsSync(oldDir)) {
            await fsp.rename(oldDir, newDir);
        }

        await this.save();
    }

    /**
     * Reads all section files in order, demotes their headings,
     * assembles them under `##` wrappers, and writes the result
     * into `this.body` and SKILL.md on disk.
     *
     * Also sets `metadataBodyFormat` to `'structured'`.
     */
    async recomposeBody(): Promise<void> {
        const parts: string[] = [];

        for (const { fileName, heading } of SECTION_NAMES) {
            const filePath = path.join(this.skillDir, 'sections', fileName);
            try {
                const content = await fsp.readFile(filePath, 'utf-8');
                const trimmed = content.trim();
                if (!trimmed) continue;
                const demoted = demoteHeadings(trimmed);
                parts.push(`# ${heading}\n${demoted}`);
            } catch {
                // section file does not exist — skip
            }
        }

        this.body = parts.join('\n\n');
        this.metadataBodyFormat = BodyFormat.Structured;
        await this.save();
    }

    /**
     * Updates `description` and/or `body` in memory and writes the
     * changes to SKILL.md on disk.
     */
    async update(data: { description?: string; body?: string }): Promise<void> {
        if (data.description !== undefined) this.description = data.description;
        if (data.body !== undefined) this.body = data.body;
        await this.save();
    }

    /**
     * Returns the contents of a resource, or `null` if it does not
     * exist or the type/name is invalid.
     *
     * Path traversal outside the resource subdirectory is blocked.
     */
    async getResource(resourceType: string, name: string): Promise<string | null> {
        const parsed = resolveResourcePath(this.skillDir, resourceType, name);
        if (!parsed) return null;
        try {
            return await fsp.readFile(parsed.resolved, 'utf-8');
        } catch {
            return null;
        }
    }

    /**
     * Writes content to a resource. When writing to sections, the
     * SKILL.md body is recomposed from all section resources.
     *
     * Throws when the type is invalid, traversal is detected, or when
     * writing sections to a non-structured skill.
     */
    async setResource(resourceType: string, name: string, content: string): Promise<void> {
        const parsed = resolveResourcePath(this.skillDir, resourceType, name);
        if (!parsed) {
            throw new Error(
                `Only resources of type references, assets, or sections can be written, and traversal outside the skill is not allowed.`
            );
        }
        if (parsed.resource === SkillResource.Sections) {
            if (!VALID_SECTION_NAMES.has(name)) {
                throw new Error(
                    `Invalid section name '${name}'. Allowed section names: ${SECTION_NAMES.map((s) => `"${s.fileName}"`).join(', ')}.`
                );
            }
            if (!this.isStructured) {
                throw new Error(
                    `Skill '${this.name}' is not a structured skill and does not have sections. Create a structured skill first (set_skill without body) or use references or assets resources.`
                );
            }
        }
        mkdirSync(path.dirname(parsed.resolved), { recursive: true });
        await fsp.writeFile(parsed.resolved, content, 'utf-8');

        if (parsed.resource === SkillResource.Sections) {
            await this.recomposeBody();
        }
    }

    /**
     * Deletes a resource. Does not error if the resource does not exist.
     * When deleting from sections, the SKILL.md body is recomposed
     * from the remaining section resources.
     *
     * Throws when the type is invalid, traversal is detected, or when
     * deleting sections from a non-structured skill.
     */
    async deleteResource(resourceType: string, name: string): Promise<void> {
        const parsed = resolveResourcePath(this.skillDir, resourceType, name);
        if (!parsed) {
            throw new Error(
                `Only resources of type references, assets, or sections can be deleted, and traversal outside the skill is not allowed.`
            );
        }
        if (parsed.resource === SkillResource.Sections) {
            if (!VALID_SECTION_NAMES.has(name)) {
                throw new Error(
                    `Invalid section name '${name}'. Allowed section names: ${SECTION_NAMES.map((s) => `"${s.fileName}"`).join(', ')}.`
                );
            }
            if (!this.isStructured) {
                throw new Error(
                    `Skill '${this.name}' is not a structured skill and does not have sections.`
                );
            }
        }
        await fsp.rm(parsed.resolved, { force: true });

        if (parsed.resource === SkillResource.Sections) {
            await this.recomposeBody();
        }
    }

    /**
     * Returns all resource files in this skill's `references/`, `assets/`,
     * and `sections/` directories. Non-recursive — only returns top-level
     * entries.
     *
     * Missing or empty resource directories are handled gracefully.
     */
    async listResources(): Promise<{ resource: SkillResource; fileName: string }[]> {
        const results: { resource: SkillResource; fileName: string }[] = [];

        for (const res of [
            SkillResource.References,
            SkillResource.Assets,
            SkillResource.Sections
        ]) {
            const dir = path.join(this.skillDir, res);
            try {
                const entries = await fsp.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isFile()) {
                        results.push({ resource: res, fileName: entry.name });
                    }
                }
            } catch {
                // directory does not exist or cannot be read — skip
            }
        }

        results.sort((a, b) =>
            a.resource === b.resource
                ? a.fileName.localeCompare(b.fileName)
                : a.resource.localeCompare(b.resource)
        );
        return results;
    }

    // ── Static factories ───────────────────────────────────────

    /**
     * Parses a `SKILL.md` string and returns a new `Skill` instance.
     *
     * The YAML frontmatter must contain `name` and `description` fields.
     * When `metadata.body-format` is `"structured"` the sections are read
     * from the `sections/` directory (not from the body) on load.
     * `rootDir` is the general skill directory (parent), not the skill's
     * own subdirectory — the subdirectory is derived from the name.
     *
     * @returns A new `Skill`, or `null` when the content is invalid.
     */
    static parse(content: string, rootDir: string): Skill | null {
        const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
        if (!match) return null;

        let parsed: Record<string, unknown>;
        try {
            parsed = yaml.load(match[1]!) as Record<string, unknown>;
        } catch {
            return null;
        }

        if (!parsed || typeof parsed !== 'object') return null;

        const name = parsed.name;
        const description = parsed.description;
        if (typeof name !== 'string' || !name || typeof description !== 'string' || !description) {
            return null;
        }

        const body = match[2]!.trim();
        const skill = new Skill(name, description, body, rootDir);

        const metadata = parsed.metadata as Record<string, unknown> | undefined;
        if (metadata && typeof metadata === 'object') {
            if (Array.isArray(metadata.tags)) {
                skill.tags = metadata.tags.filter((t): t is string => typeof t === 'string');
            }
            skill.metadataBodyFormat =
                metadata['body-format'] === 'structured' ? BodyFormat.Structured : BodyFormat.Plain;
        }

        return skill;
    }
}
