import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { normaliseName } from './helper.js';

/**
 * The two resource directories allowed inside a skill's subdirectory.
 * `References` holds supporting documentation; `Assets` holds templates,
 * images, or other binary/text files.
 */
export enum SkillResource {
    Assets = 'assets',
    References = 'references'
}

/**
 * Resolves a resource file path against `skillDir` and guards against path
 * traversal. The file must be inside `skillDir/{resource}/` after resolution.
 *
 * Returns the absolute path, or `null` if the resolved path escapes the
 * resource subdirectory.
 */
function resolveResourcePath(
    skillDir: string,
    resource: SkillResource,
    filePath: string
): string | null {
    const normalized = filePath.replace(/\\/g, '/');
    const resolved = path.resolve(skillDir, resource, normalized);
    const resourcePrefix = path.join(skillDir, resource) + path.sep;
    if (!resolved.startsWith(resourcePrefix)) return null;
    return resolved;
}

/**
 * Represents a skill with its metadata, instructions, and filesystem operations.
 *
 * Each skill lives in a subdirectory of the configured skill directory,
 * named after the skill (sanitized). The subdirectory contains `SKILL.md`
 * (YAML frontmatter + markdown body), plus optional `references/` and
 * `assets/` directories.
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

    constructor(name: string, description: string, body: string, rootDir: string) {
        this.name = name;
        this.description = description;
        this.body = body;
        this.rootDir = rootDir;
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

    /**
     * Parses a user-supplied path string like `"references/doc.md"` into
     * a {@link SkillResource} and a file name.
     *
     * Returns `null` when the prefix is neither `references` nor `assets`,
     * or when no file name follows the prefix.
     */
    static parseResourcePath(path: string): { resource: SkillResource; fileName: string } | null {
        const normalized = path.replace(/\\/g, '/');
        const slashIdx = normalized.indexOf('/');
        if (slashIdx === -1) return null;
        const prefix = normalized.slice(0, slashIdx);
        const fileName = normalized.slice(slashIdx + 1);
        if (!fileName) return null;
        const resource =
            prefix === 'references'
                ? SkillResource.References
                : prefix === 'assets'
                  ? SkillResource.Assets
                  : null;
        if (!resource) return null;
        return { resource, fileName };
    }

    /** Serializes the skill to SKILL.md format (YAML frontmatter + body). */
    serialize(): string {
        let result = `---\nname: ${this.name}\ndescription: ${this.description}\n---`;
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
     * Updates `description` and/or `body` in memory and writes the
     * changes to SKILL.md on disk.
     */
    async update(data: { description?: string; body?: string }): Promise<void> {
        if (data.description !== undefined) this.description = data.description;
        if (data.body !== undefined) this.body = data.body;
        await this.save();
    }

    /**
     * Returns the contents of a resource file, or `null` if it does not
     * exist or the path is invalid.
     *
     * Path traversal outside the resource subdirectory is blocked.
     */
    async getResource(resource: SkillResource, name: string): Promise<string | null> {
        const resolved = resolveResourcePath(this.skillDir, resource, name);
        if (!resolved) return null;
        try {
            return await fsp.readFile(resolved, 'utf-8');
        } catch {
            return null;
        }
    }

    /**
     * Writes content to a resource file, creating intermediate directories
     * as needed.
     *
     * Path traversal outside the resource subdirectory is blocked.
     */
    async setResource(resource: SkillResource, name: string, content: string): Promise<void> {
        const resolved = resolveResourcePath(this.skillDir, resource, name);
        if (!resolved) {
            throw new Error(
                `Only files in references/ and assets/ directories can be written, and path traversal is not allowed.`
            );
        }
        mkdirSync(path.dirname(resolved), { recursive: true });
        await fsp.writeFile(resolved, content, 'utf-8');
    }

    /**
     * Deletes a resource file. Does not error if the file does not exist.
     *
     * Path traversal outside the resource subdirectory is blocked.
     */
    async deleteResource(resource: SkillResource, name: string): Promise<void> {
        const resolved = resolveResourcePath(this.skillDir, resource, name);
        if (!resolved) {
            throw new Error(
                `Only files in references/ and assets/ directories can be deleted, and path traversal is not allowed.`
            );
        }
        await fsp.rm(resolved, { force: true });
    }

    /**
     * Returns all resource files in this skill's `references/` and `assets/`
     * directories. Non-recursive — only returns top-level entries.
     *
     * Missing or empty resource directories are handled gracefully.
     */
    async listResources(): Promise<{ resource: SkillResource; fileName: string }[]> {
        const results: { resource: SkillResource; fileName: string }[] = [];

        for (const res of [SkillResource.References, SkillResource.Assets]) {
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
     * `rootDir` is the general skill directory (parent), not the skill's
     * own subdirectory — the subdirectory is derived from the name.
     *
     * @returns A new `Skill`, or `null` when the content is invalid.
     */
    static parse(content: string, rootDir: string): Skill | null {
        const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
        if (!match) return null;
        const frontmatter: Record<string, string> = {};
        for (const line of match[1]!.split('\n')) {
            const colonIdx = line.indexOf(':');
            if (colonIdx === -1) continue;
            const key = line.slice(0, colonIdx).trim();
            const value = line.slice(colonIdx + 1).trim();
            if (key && value) frontmatter[key] = value;
        }
        const name = frontmatter.name;
        const description = frontmatter.description;
        const body = match[2]!.trim();
        if (!name || !description) return null;
        return new Skill(name, description, body, rootDir);
    }
}
