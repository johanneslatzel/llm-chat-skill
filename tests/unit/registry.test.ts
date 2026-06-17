import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chmodSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { PromptContainer } from '@johannes.latzel/llm-chat';
import type { ChatService } from '@johannes.latzel/llm-chat';
import { BodyFormat, SkillRegistry, SkillRegistryConfiguration, SkillResource, Skill } from '../../src/index.js';
import { demoteHeadings } from '../../src/lib/skill.js';
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
        vi.restoreAllMocks();
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

        const listing = await registry.listing();
        expect(listing).toContain('alpha:');
        expect(listing).toContain('Alpha skill');
        expect(listing).toContain('beta:');
        expect(listing).toContain('Beta skill');
        expect(listing).toContain('body-format: plain');
        expect(listing).toContain('assets: 0');
        expect(listing).toContain('references: 0');
        expect(listing).not.toContain('tags:');
    });

    it('listing includes tags when a skill has them', async () => {
        createTempDirStructure(tmpDir, {
            'tagged/SKILL.md': makeSkillFile('tagged', 'A tagged skill', 'body'),
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('tagged')!;
        skill.tags = ['deploy', 'ops', 'demo'];

        const listing = await registry.listing();
        expect(listing).toContain('tags: deploy, ops, demo');
    });

    it('listing counts assets and references per skill', async () => {
        createTempDirStructure(tmpDir, {
            'resourced/SKILL.md': makeSkillFile('resourced', 'A skill with resources', 'body'),
            'resourced/references/guide.md': 'guide',
            'resourced/references/notes.md': 'notes',
            'resourced/assets/config.json': '{}',
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const listing = await registry.listing();
        expect(listing).toContain('resourced:');
        expect(listing).toContain('- description: A skill with resources');
        expect(listing).toContain('assets: 1');
        expect(listing).toContain('references: 2');
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

    it('getResource reads files from references directory', async () => {
        createTempDirStructure(tmpDir, {
            'deep/SKILL.md': makeSkillFile('deep', 'deep skill', 'body'),
            'deep/references/doc.md': 'Reference content'
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('deep')!;
        const result = await skill.getResource('references', 'doc.md');
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
        const result = await skill.getResource('references', '../secret.txt');
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
        const result = await skill.getResource('references', '../../etc/passwd');
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
        await skill.setResource('references', 'guide.md', 'Guide content');
        const result = await skill.getResource('references', 'guide.md');
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
        await skill.setResource('assets', 'template.json', '{"key": "value"}');
        const result = await skill.getResource('assets', 'template.json');
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
        await skill.setResource('references', 'sub/deep/file.md', 'Deep content');
        const result = await skill.getResource('references', 'sub/deep/file.md');
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
        await skill.setResource('references', 'guide.md', 'New content');
        const result = await skill.getResource('references', 'guide.md');
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
            skill.setResource('references', '../outside.txt', 'content')
        ).rejects.toThrow('traversal outside the skill');
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
            skill.setResource('references', '../../outside.txt', 'content')
        ).rejects.toThrow('traversal outside the skill');
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
        await skill.deleteResource('references', 'guide.md');
        const result = await skill.getResource('references', 'guide.md');
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
            skill.deleteResource('references', 'missing.md')
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
            skill.deleteResource('references', '../outside.txt')
        ).rejects.toThrow('traversal outside the skill');
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
            skill.deleteResource('references', '../../outside.txt')
        ).rejects.toThrow('traversal outside the skill');
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

    it('serialize includes metadata tags', () => {
        const skill = new Skill('test', 'A sufficiently long description for testing', 'body', '/tmp');
        skill.tags = ['deploy', 'ops'];
        const output = skill.serialize();
        expect(output).toContain('metadata:');
        expect(output).toContain('tags:');
        expect(output).toContain('deploy');
        expect(output).toContain('ops');
    });

    it('serialize includes body-format for structured skills', () => {
        const skill = new Skill('test', 'A sufficiently long description for testing', '', '/tmp');
        skill.metadataBodyFormat = BodyFormat.Structured;
        const output = skill.serialize();
        expect(output).toContain('metadata:');
        expect(output).toContain('body-format: structured');
    });

    // ── Structured skill: updateSkill guardrail ───────────────────

    it('updateSkill rejects body on structured skill', async () => {
        createTempDirStructure(tmpDir, {
            'plain/SKILL.md': makeSkillFile('plain', 'A sufficiently long description for testing', VALID_BODY)
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        // Create a structured skill
        await registry.createSkill('structured', 'A sufficiently long description for testing', '');
        await expect(
            registry.updateSkill('structured', { body: VALID_BODY })
        ).rejects.toThrow('Cannot directly set body');
    });

    // ── Structured skill: setResource with Sections ──────────────

    it('setResource with Sections triggers recomposeBody', async () => {
        createTempDirStructure(tmpDir, {
            'struct/SKILL.md': makeSkillFile('struct', 'A sufficiently long description for testing', '')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('struct')!;
        skill.metadataBodyFormat = BodyFormat.Structured;
        await skill.setResource('sections', 'purpose.md', '# Purpose text');
        // Body should now contain recomposed content
        expect(skill.body).toContain('Purpose');
        expect(skill.body).toContain('Purpose text');
    });

    // ── Structured skill: deleteResource with Sections ───────────

    it('deleteResource with Sections triggers recomposeBody', async () => {
        createTempDirStructure(tmpDir, {
            'struct/SKILL.md': makeSkillFile('struct', 'A sufficiently long description for testing', '')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('struct')!;
        skill.metadataBodyFormat = BodyFormat.Structured;
        await skill.setResource('sections', 'purpose.md', '# Purpose text');
        expect(skill.body).toContain('Purpose text');

        await skill.deleteResource('sections', 'purpose.md');
        // Body should no longer contain the deleted section content
        expect(skill.body).not.toContain('Purpose text');
    });

    // ── demoteHeadings tests ─────────────────────────────────────

    it('demoteHeadings shifts ATX headings up one level by default', () => {
        expect(demoteHeadings('# Title')).toBe('## Title');
        expect(demoteHeadings('## Sub')).toBe('### Sub');
        expect(demoteHeadings('### Sub')).toBe('#### Sub');
        expect(demoteHeadings('#### Sub')).toBe('##### Sub');
        expect(demoteHeadings('##### Sub')).toBe('###### Sub');
    });

    it('demoteHeadings shifts ATX headings up multiple levels', () => {
        expect(demoteHeadings('# Title', 2)).toBe('### Title');
        expect(demoteHeadings('## Sub', 2)).toBe('#### Sub');
        expect(demoteHeadings('### Sub', 2)).toBe('##### Sub');
        expect(demoteHeadings('#### Sub', 2)).toBe('###### Sub');
    });

    it('demoteHeadings caps at ######', () => {
        expect(demoteHeadings('###### Deep')).toBe('###### Deep');
        expect(demoteHeadings('###### Deep', 2)).toBe('###### Deep');
        expect(demoteHeadings('##### Deep', 2)).toBe('###### Deep');
        expect(demoteHeadings('#### Deep', 3)).toBe('###### Deep');
    });

    it('demoteHeadings skips headings inside fenced code blocks', () => {
        const input = 'text\n```\n# inside code\n```\n# outside code';
        expect(demoteHeadings(input)).toBe('text\n```\n# inside code\n```\n## outside code');
        expect(demoteHeadings(input, 2)).toBe('text\n```\n# inside code\n```\n### outside code');
    });

    it('demoteHeadings handles mixed content and preserves non-heading lines', () => {
        const input = 'Paragraph text\n\n## Existing Sub\n\n- list item\n\nMore text';
        const result = demoteHeadings(input);
        expect(result).toContain('### Existing Sub');
        expect(result).toContain('Paragraph text');
        expect(result).toContain('- list item');
        expect(result).toContain('More text');
    });

    // ── listResources with sections/ ────────────────────────────

    it('listResources includes sections/ files', async () => {
        createTempDirStructure(tmpDir, {
            'struct/SKILL.md': makeSkillFile('struct', 'A sufficiently long description for testing', '')
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('struct')!;
        skill.metadataBodyFormat = BodyFormat.Structured;
        await skill.setResource('sections', 'purpose.md', '# Purpose');
        await skill.setResource('sections', 'workflow.md', '# Workflow');

        const resources = await skill.listResources();
        const sectionFiles = resources.filter((r) => r.resource === SkillResource.Sections);
        expect(sectionFiles).toHaveLength(2);
        expect(sectionFiles.find((r) => r.fileName === 'purpose.md')).toBeDefined();
        expect(sectionFiles.find((r) => r.fileName === 'workflow.md')).toBeDefined();
    });

    // ── createSkill with empty body creates structured shell ─────

    it('createSkill with empty body creates structured skill', async () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = await registry.createSkill('struct_skill', 'A sufficiently long description for testing', '');
        expect(skill.isStructured).toBe(true);
        expect(skill.metadataBodyFormat).toBe(BodyFormat.Structured);
        expect(skill.body).toBe('');
    });

    // ── Skill.parse direct tests ─────────────────────────────────

    it('parse returns null for content without frontmatter', () => {
        const result = Skill.parse('no frontmatter here', tmpDir);
        expect(result).toBeNull();
    });

    it('parse returns null for invalid YAML in frontmatter', () => {
        const result = Skill.parse('---\n{invalid: yaml:\n---\nbody', tmpDir);
        expect(result).toBeNull();
    });

    it('parse returns null for non-object YAML', () => {
        const result = Skill.parse('---\n"just a string"\n---\nbody', tmpDir);
        expect(result).toBeNull();
    });

    it('parse returns null when name or description is missing', () => {
        const result = Skill.parse('---\nname: only_name\n---\nbody', tmpDir);
        expect(result).toBeNull();
    });

    it('parse returns null when name or description is empty', () => {
        const result = Skill.parse('---\nname: \ndescription: \n---\nbody', tmpDir);
        expect(result).toBeNull();
    });

    it('parse reads body-format: structured from metadata', () => {
        const content = `---
name: structured
description: A structured skill for testing
metadata:
  body-format: structured
---
`;
        const skill = Skill.parse(content, tmpDir);
        expect(skill).not.toBeNull();
        expect(skill!.isStructured).toBe(true);
        expect(skill!.metadataBodyFormat).toBe(BodyFormat.Structured);
    });

    it('parse handles non-array tags gracefully', () => {
        const content = `---
name: tagged
description: A skill with weird tags
metadata:
  tags: "not an array"
---
body
`;
        const skill = Skill.parse(content, tmpDir);
        expect(skill).not.toBeNull();
        expect(skill!.tags).toEqual([]);
    });

    it('parse handles valid tags', () => {
        const content = `---
name: tagged
description: A skill with tags
metadata:
  tags:
    - deploy
    - ops
---
body
`;
        const skill = Skill.parse(content, tmpDir);
        expect(skill).not.toBeNull();
        expect(skill!.tags).toEqual(['deploy', 'ops']);
    });

    // ── Skill.nameToDirName ─────────────────────────────────────

    it('nameToDirName normalises names', () => {
        expect(Skill.nameToDirName('My Cool Skill!')).toBe('my-cool-skill');
        expect(Skill.nameToDirName('simple')).toBe('simple');
        expect(Skill.nameToDirName('UPPERCASE')).toBe('uppercase');
        expect(Skill.nameToDirName('special_chars@#$')).toBe('special_chars');
    });

    // ── Skill.dirName / skillDir ────────────────────────────────

    it('dirName returns sanitised name', () => {
        const skill = new Skill('My Skill!', 'A sufficiently long description', 'body', tmpDir);
        expect(skill.dirName).toBe('my-skill');
    });

    it('skillDir joins rootDir with dirName', () => {
        const skill = new Skill('test_skill', 'A sufficiently long description', 'body', tmpDir);
        expect(skill.skillDir).toBe(path.join(tmpDir, 'test_skill'));
    });

    // ── Skill.getResource edge cases ────────────────────────────

    it('getResource returns null for invalid resource type', async () => {
        const skill = new Skill('test', 'A sufficiently long description', 'body', tmpDir);
        await skill.save();
        const result = await skill.getResource('bogus', 'file.md');
        expect(result).toBeNull();
    });

    it('getResource returns null for empty name', async () => {
        const skill = new Skill('test', 'A sufficiently long description', 'body', tmpDir);
        await skill.save();
        const result = await skill.getResource('references', '');
        expect(result).toBeNull();
    });

    // ── Skill.setResource with invalid type ────────────────────

    it('setResource throws for invalid resource type', async () => {
        const skill = new Skill('test', 'A sufficiently long description', 'body', tmpDir);
        await skill.save();
        await expect(
            skill.setResource('bogus', 'file.md', 'content')
        ).rejects.toThrow('Only resources of type references, assets, or sections can be written');
    });

    // ── Skill.deleteResource sections guardrail on plain skill ──

    // ── Skill.setResource with invalid section name ──────────────

    it('setResource with sections and invalid name throws error', async () => {
        const skill = new Skill('test', 'A sufficiently long description', '', tmpDir);
        await skill.save();
        skill.metadataBodyFormat = BodyFormat.Structured;
        await expect(
            skill.setResource('sections', 'foo.md', 'content')
        ).rejects.toThrow('Invalid section name');
    });

    // ── Skill.deleteResource with invalid section name ───────────

    it('deleteResource with sections and invalid name throws error', async () => {
        const skill = new Skill('test', 'A sufficiently long description', '', tmpDir);
        await skill.save();
        skill.metadataBodyFormat = BodyFormat.Structured;
        await expect(
            skill.deleteResource('sections', 'bar.md')
        ).rejects.toThrow('Invalid section name');
    });

    // ── Only predefined section names are accepted ───────────────

    it.each([
        'purpose.md',
        'inputs-outputs.md',
        'constraints.md',
        'workflow.md',
        'decision-criteria.md',
        'examples.md',
        'anti-patterns.md'
    ])('accepts predefined section name "%s"', async (fileName) => {
        const skill = new Skill('test', 'A sufficiently long description', '', tmpDir);
        await skill.save();
        skill.metadataBodyFormat = BodyFormat.Structured;
        await expect(
            skill.setResource('sections', fileName, `# ${fileName} content`)
        ).resolves.toBeUndefined();
    });

    it.each([
        'purpose.md',
        'inputs-outputs.md',
        'constraints.md',
        'workflow.md',
        'decision-criteria.md',
        'examples.md',
        'anti-patterns.md'
    ])('rejects non-predefined section name "%s"', async (fileName) => {
        const skill = new Skill('test', 'A sufficiently long description', '', tmpDir);
        await skill.save();
        skill.metadataBodyFormat = BodyFormat.Structured;
        await expect(
            skill.setResource('sections', `not-${fileName}`, 'content')
        ).rejects.toThrow('Invalid section name');
    });

    // ── Skill.deleteResource sections guardrail on plain skill ──

    it('deleteResource on sections throws for plain skill', async () => {
        const skill = new Skill('test', 'A sufficiently long description', 'body', tmpDir);
        await skill.save();
        await expect(
            skill.deleteResource('sections', 'purpose.md')
        ).rejects.toThrow('not a structured skill');
    });

    // ── recomposeBody edge cases ────────────────────────────────

    it('recomposeBody with no section files produces empty body', async () => {
        const skill = new Skill('test', 'A sufficiently long description', 'body', tmpDir);
        await skill.save();
        await skill.recomposeBody();
        expect(skill.body).toBe('');
        expect(skill.isStructured).toBe(true);
    });

    it('recomposeBody with empty section file is skipped', async () => {
        const skill = new Skill('test', 'A sufficiently long description', 'body', tmpDir);
        await skill.save();
        mkdirSync(path.join(skill.skillDir, 'sections'), { recursive: true });
        writeFileSync(path.join(skill.skillDir, 'sections', 'purpose.md'), '   ', 'utf-8');
        await skill.recomposeBody();
        // Empty whitespace-only file should be skipped
        expect(skill.body).toBe('');
        expect(skill.isStructured).toBe(true);
    });

    // ── Skill.remove on non-existent dir ────────────────────────

    it('remove does not error when directory does not exist', async () => {
        const skill = new Skill('test', 'A sufficiently long description', 'body', '/nonexistent/path');
        await expect(skill.remove()).resolves.toBeUndefined();
    });

    // ── Skill.update edge cases ─────────────────────────────────

    it('update with no changes preserves existing values', async () => {
        const skill = new Skill('test', 'A sufficiently long description', 'body', tmpDir);
        await skill.save();
        await skill.update({});
        expect(skill.description).toBe('A sufficiently long description');
        expect(skill.body).toBe('body');
    });

    it('update with partial data only changes provided fields', async () => {
        const skill = new Skill('test', 'A sufficiently long description', 'body', tmpDir);
        await skill.save();
        await skill.update({ description: 'New desc only' });
        expect(skill.description).toBe('New desc only');
        expect(skill.body).toBe('body');
    });

    // ── serialize edge cases ────────────────────────────────────

    it('serialize omits metadata when tags are empty and body-format is plain', () => {
        const skill = new Skill('test', 'A sufficiently long description for testing', 'body', tmpDir);
        const output = skill.serialize();
        expect(output).not.toContain('metadata:');
    });

    // ── System prompt wiring tests ──────────────────────────

    describe('system prompt wiring', () => {
        it('initialize with service wires listing into skills prompt', async () => {
            createTempDirStructure(tmpDir, {
                'skill_a/SKILL.md': makeSkillFile('skill_a', 'Alpha skill', 'A body'),
                'skill_b/SKILL.md': makeSkillFile('skill_b', 'Beta skill', 'B body'),
            });

            const config = new SkillRegistryConfiguration(tmpDir);
            const registry = new SkillRegistry(config);

            const rootContainer = new PromptContainer('');
            const mockService = {
                chat: () => ({ system: () => rootContainer }),
            } as unknown as ChatService;

            await registry.initialize(mockService);

            const prompt = rootContainer.prompt('skills');
            expect(prompt.hasContent()).toBe(true);
            expect(prompt.content()).toContain('skill_a');
            expect(prompt.content()).toContain('Alpha skill');
            expect(prompt.content()).toContain('skill_b');
            expect(prompt.content()).toContain('Beta skill');
        });

        it('initialize without service does not wire prompt', async () => {
            const registry = new SkillRegistry();
            await registry.initialize();
            expect(registry.list()).toEqual([]);
        });

        it('createSkill refreshes the skills prompt', async () => {
            const config = new SkillRegistryConfiguration(tmpDir);
            const registry = new SkillRegistry(config);

            const rootContainer = new PromptContainer('');
            const mockService = {
                chat: () => ({ system: () => rootContainer }),
            } as unknown as ChatService;

            await registry.initialize(mockService);

            let prompt = rootContainer.prompt('skills');
            expect(prompt.content()).toBe('Available skills:');

            await registry.createSkill('new_skill', 'A sufficiently long description for testing', 'B'.repeat(300));

            prompt = rootContainer.prompt('skills');
            expect(prompt.content()).toContain('new_skill');
        });

        it('deleteSkill refreshes the skills prompt', async () => {
            createTempDirStructure(tmpDir, {
                'todelete/SKILL.md': makeSkillFile('todelete', 'A sufficiently long description for testing', 'body'),
            });

            const config = new SkillRegistryConfiguration(tmpDir);
            const registry = new SkillRegistry(config);

            const rootContainer = new PromptContainer('');
            const mockService = {
                chat: () => ({ system: () => rootContainer }),
            } as unknown as ChatService;

            await registry.initialize(mockService);

            let prompt = rootContainer.prompt('skills');
            expect(prompt.content()).toContain('todelete');

            await registry.deleteSkill('todelete');

            prompt = rootContainer.prompt('skills');
            expect(prompt.content()).not.toContain('todelete');
        });

        it('updateSkill refreshes the skills prompt on description change', async () => {
            createTempDirStructure(tmpDir, {
                'updateme/SKILL.md': makeSkillFile('updateme', 'A sufficiently long description for testing', 'body'),
            });

            const config = new SkillRegistryConfiguration(tmpDir);
            const registry = new SkillRegistry(config);

            const rootContainer = new PromptContainer('');
            const mockService = {
                chat: () => ({ system: () => rootContainer }),
            } as unknown as ChatService;

            await registry.initialize(mockService);

            await registry.updateSkill('updateme', {
                description: 'Updated sufficiently long description for testing',
            });

            const prompt = rootContainer.prompt('skills');
            expect(prompt.content()).toContain('Updated sufficiently long description');
        });
    });
});


