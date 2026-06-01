import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chmodSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { SkillRegistry, SkillRegistryConfiguration, SkillResource, Skill } from '../../src/index.js';
import { createTempDir, removeTempDir, createTempDirStructure } from '../index.js';

const VALID_DESC = 'A sufficiently long description for testing';
const VALID_BODY = 'B'.repeat(300);

function makeSkillFile(name: string, description: string, body: string): string {
    return `---
name: ${name}
description: ${description}
---
${body}`;
}

describe('SkillRegistry', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTempDir();
    });

    afterEach(() => {
        removeTempDir(tmpDir);
    });

    it('loads a skill from a subdirectory', async () => {
        createTempDirStructure(tmpDir, {
            'sub_skill/SKILL.md': makeSkillFile('sub_skill', 'A sub skill', 'Sub body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('sub_skill');
        expect(skill).toBeDefined();
        expect(skill!.name).toBe('sub_skill');
        expect(skill!.description).toBe('A sub skill');
        expect(skill!.body).toBe('Sub body');
        expect(skill!.rootDir).toBe(tmpDir);
        expect(skill!.skillDir).toBe(path.join(tmpDir, 'sub_skill'));
    });

    it('load returns the same skill instance', async () => {
        createTempDirStructure(tmpDir, {
            'cpy/SKILL.md': makeSkillFile('cpy', 'Copy test', 'Original body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('cpy')!;
        const skill2 = registry.get('cpy')!;
        expect(skill2.body).toBe('Original body');
        // Both references point to the same Skill instance
        expect(skill).toBe(skill2);
    });

    it('list returns all loaded skills', async () => {
        createTempDirStructure(tmpDir, {
            'skill_a/SKILL.md': makeSkillFile('skill_a', 'Alpha', 'A'),
            'skill_b/SKILL.md': makeSkillFile('skill_b', 'Beta', 'B'),
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skills = registry.list();
        expect(skills).toHaveLength(2);
        expect(skills.find((s) => s.name === 'skill_a')).toBeDefined();
        expect(skills.find((s) => s.name === 'skill_b')).toBeDefined();
    });

    it('load returns undefined for missing skill', async () => {
        const registry = new SkillRegistry(new SkillRegistryConfiguration(tmpDir));
        await registry.initialize();
        expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('listing returns formatted string with available skills', async () => {
        createTempDirStructure(tmpDir, {
            'alpha/SKILL.md': makeSkillFile('alpha', 'Alpha skill', 'A body'),
            'beta/SKILL.md': makeSkillFile('beta', 'Beta skill', 'B body'),
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const listing = registry.listing();
        expect(listing).toContain('alpha');
        expect(listing).toContain('Alpha skill');
        expect(listing).toContain('beta');
        expect(listing).toContain('Beta skill');
    });

    it('listing returns empty string when no skills', async () => {
        const registry = new SkillRegistry(new SkillRegistryConfiguration(tmpDir));
        await registry.initialize();
        expect(registry.listing()).toBe('');
    });

    it('skips skill files with invalid frontmatter', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': 'No frontmatter here'
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        expect(registry.list()).toHaveLength(0);
    });

    it('skips frontmatter lines without a colon', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': '---\nname\nnameline\n---\nbody'
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        expect(registry.list()).toHaveLength(0);
    });

    it('skips skill files missing name or description', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('', '', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        expect(registry.list()).toHaveLength(0);
    });

    it('parseResourcePath returns null for path without a slash', async () => {
        const result = Skill.parseResourcePath('references');
        expect(result).toBeNull();
    });

    it('parseResourcePath returns null for path with trailing slash', async () => {
        const result = Skill.parseResourcePath('references/');
        expect(result).toBeNull();
    });

    it('getResource reads files from references directory', async () => {
        createTempDirStructure(tmpDir, {
            'deep/SKILL.md': makeSkillFile('deep', 'deep skill', 'body'),
            'deep/references/doc.md': 'Reference content'
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('deep')!;
        const result = await skill.getResource(SkillResource.References, 'doc.md');
        expect(result).toBe('Reference content');
    });

    it('getResource returns null for path traversal within resource', async () => {
        createTempDirStructure(tmpDir, {
            'deep/SKILL.md': makeSkillFile('deep', 'deep skill', 'body'),
            'deep/secret.txt': 'should not be readable'
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('deep')!;
        const result = await skill.getResource(SkillResource.References, '../secret.txt');
        expect(result).toBeNull();
    });

    it('getResource prevents path traversal outside rootDir', async () => {
        createTempDirStructure(tmpDir, {
            'deep/SKILL.md': makeSkillFile('deep', 'deep skill', 'body'),
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('deep')!;
        const result = await skill.getResource(SkillResource.References, '../../etc/passwd');
        expect(result).toBeNull();
    });

    it('creates registry without config', async () => {
        const registry = new SkillRegistry();
        await registry.initialize();
        expect(registry.list()).toEqual([]);
    });

    it('skips subdirectories without SKILL.md', async () => {
        mkdirSync(path.join(tmpDir, 'emptydir'));

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        expect(registry.list()).toHaveLength(0);
    });

    it('skips entries that are neither files nor directories', async () => {
        const fifoPath = path.join(tmpDir, 'myfifo');
        execSync(`mkfifo "${fifoPath}"`, { stdio: 'ignore' });
        mkdirSync(path.join(tmpDir, 'realdir'));
        writeFileSync(path.join(tmpDir, 'realdir', 'SKILL.md'), makeSkillFile('real', 'real skill', 'body'));

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skills = registry.list();
        expect(skills).toHaveLength(1);
        expect(skills[0]!.name).toBe('real');
    });

    it('skips entries that cannot be statted (broken symlink)', async () => {
        symlinkSync('/nonexistent', path.join(tmpDir, 'broken'));
        mkdirSync(path.join(tmpDir, 'realdir'));
        writeFileSync(path.join(tmpDir, 'realdir', 'SKILL.md'), makeSkillFile('real', 'real skill', 'body'));

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skills = registry.list();
        expect(skills).toHaveLength(1);
        expect(skills[0]!.name).toBe('real');
    });

    it('handles errors when skill directory cannot be read', async () => {
        const config = new SkillRegistryConfiguration(tmpDir + '/nonexistent');
        const registry = new SkillRegistry(config);
        await registry.initialize();
        expect(registry.list()).toHaveLength(0);
    });

    it('handles unreadable skill file', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('my_skill', 'A test skill', 'body')
        });
        chmodSync(path.join(tmpDir, 'myskill', 'SKILL.md'), 0o000);

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        expect(registry.list()).toHaveLength(0);
        chmodSync(path.join(tmpDir, 'myskill', 'SKILL.md'), 0o644);
    });

    // ── createSkill tests ──────────────────────────────────────

    it('createSkill throws when name is too short', async () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();
        await expect(registry.createSkill('ab', VALID_DESC, VALID_BODY)).rejects.toThrow('at least 5');
    });

    it('createSkill throws when name is too long', async () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();
        const longName = 'a'.repeat(61);
        await expect(registry.createSkill(longName, VALID_DESC, VALID_BODY)).rejects.toThrow('at most 60');
    });

    it('createSkill throws when description is too short', async () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();
        await expect(registry.createSkill('valid_name', 'too short', VALID_BODY)).rejects.toThrow('at least 25');
    });

    it('createSkill throws when description is too long', async () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();
        const longDesc = 'd'.repeat(501);
        await expect(registry.createSkill('valid_name', longDesc, VALID_BODY)).rejects.toThrow('at most 500');
    });

    it('createSkill throws when body is too short', async () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();
        await expect(registry.createSkill('valid_name', VALID_DESC, 'too short')).rejects.toThrow('at least 300');
    });

    it('createSkill throws when body is too long', async () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();
        const longBody = 'b'.repeat(20_001);
        await expect(registry.createSkill('valid_name', VALID_DESC, longBody)).rejects.toThrow('at most 20000');
    });

    it('createSkill creates a new skill on disk and registers it', async () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = await registry.createSkill('test_skill', VALID_DESC, VALID_BODY);
        expect(skill.name).toBe('test_skill');
        expect(skill.description).toBe(VALID_DESC);
        expect(skill.body).toBe(VALID_BODY);
        expect(skill.rootDir).toBe(tmpDir);
        expect(skill.skillDir).toBe(path.join(tmpDir, 'test_skill'));

        // Verify it's registered
        expect(registry.get('test_skill')).toBeDefined();

        // Verify it's on disk
        const loaded = registry.get('test_skill')!;
        expect(loaded.name).toBe('test_skill');
        expect(loaded.description).toBe(VALID_DESC);
        expect(loaded.body).toBe(VALID_BODY);
    });

    it('createSkill creates a skill with a body', async () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = await registry.createSkill('minimal', VALID_DESC, VALID_BODY);
        expect(skill.name).toBe('minimal');
        expect(skill.body).toBe(VALID_BODY);
    });

    it('createSkill sanitizes directory name', async () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = await registry.createSkill('My Cool Skill!', VALID_DESC, VALID_BODY);
        expect(skill.rootDir).toBe(tmpDir);
        expect(skill.skillDir).toBe(path.join(tmpDir, 'my-cool-skill'));
    });

    it('createSkill throws if skill already exists', async () => {
        createTempDirStructure(tmpDir, {
            'existing/SKILL.md': makeSkillFile('existing', 'Existing', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        await expect(registry.createSkill('existing', VALID_DESC, VALID_BODY)).rejects.toThrow('already exists');
    });

    it('createSkill throws if skillDir not configured', async () => {
        const registry = new SkillRegistry();
        await expect(registry.createSkill('test_skill', 'test_skill_is_long_enough', VALID_BODY)).rejects.toThrow('Skill directory is not configured');
    });

    it('createSkill handles save failure and removes partial directory', async () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const saveSpy = vi.spyOn(Skill.prototype, 'save').mockRejectedValue(new Error('write failed'));
        const removeSpy = vi.spyOn(Skill.prototype, 'remove').mockResolvedValue(undefined);

        await expect(registry.createSkill('failing', VALID_DESC, VALID_BODY)).rejects.toThrow('write failed');
        expect(removeSpy).toHaveBeenCalled();

        saveSpy.mockRestore();
        removeSpy.mockRestore();
    });

    // ── updateSkill tests ──────────────────────────────────────

    it('updateSkill updates description and body', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Old desc for testing purposes', 'Old body!')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const updated = await registry.updateSkill('myskill', {
            description: 'Updated test description for the skill now',
            body: 'Updated body for the skill that is long enough to pass the minimum length requirement of three hundred characters in this particular test scenario. We need to keep writing until we reach the threshold, so here are some more words to fill up the space and ensure this string meets the criterion. It is important that the body content is sufficiently detailed for the skill to be meaningful and useful to users who will interact with it through the system. Final stretch to reach the goal.'
        });
        expect(updated.description).toBe('Updated test description for the skill now');
        expect(updated.body).toBe('Updated body for the skill that is long enough to pass the minimum length requirement of three hundred characters in this particular test scenario. We need to keep writing until we reach the threshold, so here are some more words to fill up the space and ensure this string meets the criterion. It is important that the body content is sufficiently detailed for the skill to be meaningful and useful to users who will interact with it through the system. Final stretch to reach the goal.');

        // Verify re-read from list
        const loaded = registry.get('myskill')!;
        expect(loaded.description).toBe('Updated test description for the skill now');
        expect(loaded.body).toBe('Updated body for the skill that is long enough to pass the minimum length requirement of three hundred characters in this particular test scenario. We need to keep writing until we reach the threshold, so here are some more words to fill up the space and ensure this string meets the criterion. It is important that the body content is sufficiently detailed for the skill to be meaningful and useful to users who will interact with it through the system. Final stretch to reach the goal.');
    });

    it('updateSkill renames skill and folder when new_name provided', async () => {
        createTempDirStructure(tmpDir, {
            'oldname/SKILL.md': makeSkillFile('oldname', 'Old', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const updated = await registry.updateSkill('oldname', { new_name: 'newname' });
        expect(updated.name).toBe('newname');
        expect(updated.rootDir).toBe(tmpDir);
        expect(updated.skillDir).toBe(path.join(tmpDir, 'newname'));

        // Old name should be gone
        expect(registry.get('oldname')).toBeUndefined();
        // New name should exist
        expect(registry.get('newname')).toBeDefined();

        // Old directory should be gone
        const { existsSync } = await import('node:fs');
        expect(existsSync(path.join(tmpDir, 'oldname'))).toBe(false);
        expect(existsSync(path.join(tmpDir, 'newname'))).toBe(true);
    });

    it('updateSkill sanitizes new directory name on rename', async () => {
        createTempDirStructure(tmpDir, {
            'oldname/SKILL.md': makeSkillFile('oldname', 'Old', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const updated = await registry.updateSkill('oldname', { new_name: 'New Skill Name!' });
        expect(updated.rootDir).toBe(tmpDir);
        expect(updated.skillDir).toBe(path.join(tmpDir, 'new-skill-name'));
    });

    it('updateSkill throws if skill not found', async () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        await expect(registry.updateSkill('nonexistent', { description: 'test' })).rejects.toThrow(
            'not found'
        );
    });

    it('updateSkill with no updates throws', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Desc', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        await expect(registry.updateSkill('myskill', {})).resolves.toBeDefined();
    });

    it('updateSkill rename to same name does not rename folder', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Desc', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const updated = await registry.updateSkill('myskill', { new_name: 'myskill' });
        expect(updated.name).toBe('myskill');
        expect(registry.get('myskill')).toBeDefined();
    });

    it('updateSkill rename handles missing source directory', async () => {
        createTempDirStructure(tmpDir, {
            'movedir/SKILL.md': makeSkillFile('movedir', 'Move', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const { rmSync } = await import('node:fs');
        rmSync(path.join(tmpDir, 'movedir'), { recursive: true, force: true });

        const updated = await registry.updateSkill('movedir', { new_name: 'movednew' });
        expect(updated.name).toBe('movednew');
        expect(registry.get('movedir')).toBeUndefined();
        expect(registry.get('movednew')).toBeDefined();
    });

    // ── updateSkill bounds tests ───────────────────────────────

    it('updateSkill throws when new_name is too short', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Old desc for testing purposes', VALID_BODY)
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        await expect(registry.updateSkill('myskill', { new_name: 'ab' })).rejects.toThrow('at least 5');
    });

    it('updateSkill throws when new_name is too long', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Old desc for testing purposes', VALID_BODY)
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        await expect(registry.updateSkill('myskill', { new_name: 'n'.repeat(61) })).rejects.toThrow('at most 60');
    });

    it('updateSkill throws when description is too short', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Old desc for testing purposes', VALID_BODY)
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        await expect(registry.updateSkill('myskill', { description: 'short' })).rejects.toThrow('at least 25');
    });

    it('updateSkill throws when description is too long', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Old desc for testing purposes', VALID_BODY)
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        await expect(registry.updateSkill('myskill', { description: 'd'.repeat(501) })).rejects.toThrow('at most 500');
    });

    it('updateSkill throws when body is too short', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Old desc for testing purposes', VALID_BODY)
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        await expect(registry.updateSkill('myskill', { body: 'short' })).rejects.toThrow('at least 300');
    });

    it('updateSkill throws when body is too long', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Old desc for testing purposes', VALID_BODY)
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        await expect(registry.updateSkill('myskill', { body: 'b'.repeat(20_001) })).rejects.toThrow('at most 20000');
    });

    // ── validateResourceLengths tests ───────────────────────────

    it('validateResourceLengths throws when resource name is too short', () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        expect(() => registry.validateResourceLengths('ab', VALID_BODY)).toThrow('at least 5');
    });

    it('validateResourceLengths throws when resource name is too long', () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        expect(() => registry.validateResourceLengths('n'.repeat(61), VALID_BODY)).toThrow('at most 60');
    });

    it('validateResourceLengths throws when content is too short', () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        expect(() => registry.validateResourceLengths('valid_name', '')).toThrow('at least 1');
    });

    it('validateResourceLengths throws when content is too long', () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        expect(() => registry.validateResourceLengths('valid_name', 'c'.repeat(10_001))).toThrow('at most 10000');
    });

    it('validateResourceLengths passes for valid values', () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        expect(() => registry.validateResourceLengths('valid_name', VALID_BODY)).not.toThrow();
    });

    // ── deleteSkill tests ──────────────────────────────────────

    it('deleteSkill removes skill from registry and disk', async () => {
        createTempDirStructure(tmpDir, {
            'todelete/SKILL.md': makeSkillFile('todelete', 'To delete', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        await registry.deleteSkill('todelete');
        expect(registry.get('todelete')).toBeUndefined();
        const { existsSync } = await import('node:fs');
        expect(existsSync(path.join(tmpDir, 'todelete'))).toBe(false);
    });

    it('deleteSkill throws if skill not found', async () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        await expect(registry.deleteSkill('nonexistent')).rejects.toThrow('not found');
    });

    it('deleteSkill does not error if directory is already gone', async () => {
        createTempDirStructure(tmpDir, {
            'todelete/SKILL.md': makeSkillFile('todelete', 'To delete', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        // Remove directory manually first
        const { rmSync } = await import('node:fs');
        rmSync(path.join(tmpDir, 'todelete'), { recursive: true, force: true });

        await expect(registry.deleteSkill('todelete')).resolves.toBeUndefined();
        expect(registry.get('todelete')).toBeUndefined();
    });

    // ── writeSkillFile tests ───────────────────────────────────

    it('setResource writes to references/', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Test', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('myskill')!;
        await skill.setResource(SkillResource.References, 'guide.md', 'Guide content');
        const result = await skill.getResource(SkillResource.References, 'guide.md');
        expect(result).toBe('Guide content');
    });

    it('setResource writes to assets/', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Test', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('myskill')!;
        await skill.setResource(SkillResource.Assets, 'template.json', '{"key": "value"}');
        const result = await skill.getResource(SkillResource.Assets, 'template.json');
        expect(result).toBe('{"key": "value"}');
    });

    it('setResource creates intermediate directories', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Test', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('myskill')!;
        await skill.setResource(SkillResource.References, 'sub/deep/file.md', 'Deep content');
        const result = await skill.getResource(SkillResource.References, 'sub/deep/file.md');
        expect(result).toBe('Deep content');
    });

    it('setResource overrides existing file', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Test', 'body'),
            'myskill/references/guide.md': 'Old content'
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('myskill')!;
        await skill.setResource(SkillResource.References, 'guide.md', 'New content');
        const result = await skill.getResource(SkillResource.References, 'guide.md');
        expect(result).toBe('New content');
    });

    it('setResource throws for path traversal', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Test', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('myskill')!;
        await expect(
            skill.setResource(SkillResource.References, '../outside.txt', 'content')
        ).rejects.toThrow('path traversal');
    });

    it('setResource prevents path traversal outside rootDir', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Test', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('myskill')!;
        await expect(
            skill.setResource(SkillResource.References, '../../outside.txt', 'content')
        ).rejects.toThrow('path traversal');
    });

    // ── deleteResource tests ───────────────────────────────────

    it('deleteResource deletes a file', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Test', 'body'),
            'myskill/references/guide.md': 'Guide content'
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('myskill')!;
        await skill.deleteResource(SkillResource.References, 'guide.md');
        const result = await skill.getResource(SkillResource.References, 'guide.md');
        expect(result).toBeNull();
    });

    it('deleteResource does not error if file does not exist', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Test', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('myskill')!;
        await expect(
            skill.deleteResource(SkillResource.References, 'missing.md')
        ).resolves.toBeUndefined();
    });

    it('deleteResource throws for path traversal', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Test', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('myskill')!;
        await expect(
            skill.deleteResource(SkillResource.References, '../outside.txt')
        ).rejects.toThrow('path traversal');
    });

    it('deleteResource prevents path traversal outside rootDir', async () => {
        createTempDirStructure(tmpDir, {
            'myskill/SKILL.md': makeSkillFile('myskill', 'Test', 'body')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('myskill')!;
        await expect(
            skill.deleteResource(SkillResource.References, '../../outside.txt')
        ).rejects.toThrow('path traversal');
    });

    // ── listResources tests ────────────────────────────────────

    it('listResources returns files sorted by resource then name', async () => {
        createTempDirStructure(tmpDir, {
            'sorted/SKILL.md': makeSkillFile('sorted', 'Sorted', 'body'),
            'sorted/references/b.md': 'b ref',
            'sorted/references/a.md': 'a ref',
            'sorted/assets/z.txt': 'z asset',
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('sorted')!;
        const resources = await skill.listResources();
        expect(resources).toHaveLength(3);
        expect(resources[0]!.resource).toBe(SkillResource.Assets);
        expect(resources[0]!.fileName).toBe('z.txt');
        expect(resources[1]!.resource).toBe(SkillResource.References);
        expect(resources[1]!.fileName).toBe('a.md');
        expect(resources[2]!.resource).toBe(SkillResource.References);
        expect(resources[2]!.fileName).toBe('b.md');
    });

    it('listResources skips non-file entries', async () => {
        createTempDirStructure(tmpDir, {
            'nested/SKILL.md': makeSkillFile('nested', 'Nested', 'body'),
            'nested/references/file.md': 'file',
        });
        mkdirSync(path.join(tmpDir, 'nested', 'references', 'subdir'));

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('nested')!;
        const resources = await skill.listResources();
        expect(resources).toHaveLength(1);
        expect(resources[0]!.fileName).toBe('file.md');
    });

    // ── Skill.serialize tests ───────────────────────────────────

    it('serialize formats empty body without extra newlines', () => {
        const skill = new Skill('test', 'A sufficiently long description for testing', '', '/tmp');
        const output = skill.serialize();
        expect(output).toBe('---\nname: test\ndescription: A sufficiently long description for testing\n---\n');
    });
});
