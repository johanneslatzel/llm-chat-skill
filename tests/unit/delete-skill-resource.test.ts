import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkillRegistry, SkillRegistryConfiguration, SkillResource, Skill, DeleteSkillResourceTool } from '../../src/index.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';
import { createTempDir, removeTempDir, createTempDirStructure } from '../index.js';

function makeSkillFile(name: string, description: string, body: string): string {
    return `---
name: ${name}
description: ${description}
---
${body}`;
}

describe('DeleteSkillResourceTool', () => {
    let tmpDir: string;
    let registry: SkillRegistry;

    beforeEach(async () => {
        tmpDir = createTempDir();
        createTempDirStructure(tmpDir, {
            'my_skill/SKILL.md': makeSkillFile('my_skill', 'Test skill', 'body')
        });
        const config = new SkillRegistryConfiguration(tmpDir);
        registry = new SkillRegistry(config);
        await registry.initialize();
    });

    afterEach(() => {
        removeTempDir(tmpDir);
    });

    it('deletes a file', async () => {
        const s = registry.get('my_skill')!;
        await s.setResource(SkillResource.References, 'guide.md', 'content');

        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resource_name: 'references/guide.md'
        });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('deleted');

        const skill = registry.get('my_skill')!;
        const content = await skill.getResource(SkillResource.References, 'guide.md');
        expect(content).toBeNull();
    });

    it('succeeds when file does not exist', async () => {
        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resource_name: 'references/missing.md'
        });
        expect(result.status).toBe(ResultStatus.Success);
    });

    it('reports error for missing skill_name', async () => {
        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            resource_name: 'references/guide.md'
        });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('skill_name');
    });

    it('reports error for missing resource_name', async () => {
        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill'
        });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('resource_name');
    });

    it('reports error for unknown skill', async () => {
        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'nonexistent',
            resource_name: 'references/guide.md'
        });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('not found');
    });

    it('reports error for path outside references or assets', async () => {
        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resource_name: 'other/secret.txt'
        });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('must start with');
    });

    it('handles filesystem error during deletion', async () => {
        const tool = new DeleteSkillResourceTool(registry);
        vi.spyOn(Skill.prototype, 'deleteResource').mockRejectedValue(new Error('permission denied'));
        const result = await tool.execute({
            skill_name: 'my_skill',
            resource_name: 'references/guide.md'
        });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('permission denied');
    });
});
