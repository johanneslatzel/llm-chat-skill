import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkillRegistry, SkillRegistryConfiguration, SkillResource, Skill, SetSkillResourceTool } from '../../src/index.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';
import { createTempDir, removeTempDir, createTempDirStructure } from '../index.js';

function makeSkillFile(name: string, description: string, body: string): string {
    return `---
name: ${name}
description: ${description}
---
${body}`;
}

describe('SetSkillResourceTool', () => {
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

    it('writes a reference file', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resource_name: 'references/guide.md',
            content: 'Guide content'
        });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('written');

        const skill = registry.get('my_skill')!;
        const content = await skill.getResource(SkillResource.References, 'guide.md');
        expect(content).toBe('Guide content');
    });

    it('writes an asset file', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resource_name: 'assets/template.json',
            content: '{"key": "value"}'
        });
        expect(result.status).toBe(ResultStatus.Success);
    });

    it('reports error when content is missing', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resource_name: 'references/guide.md'
        });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('content');
    });

    it('reports error for missing skill_name', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            resource_name: 'references/guide.md',
            content: 'test'
        });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('skill_name');
    });

    it('reports error for missing resource_name', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            content: 'test'
        });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('resource_name');
    });

    it('reports error for unknown skill', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'nonexistent',
            resource_name: 'references/guide.md',
            content: 'test'
        });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('not found');
    });

    it('reports error for path outside references or assets', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resource_name: 'other/secret.txt',
            content: 'test'
        });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('must start with');
    });

    it('handles filesystem error during write', async () => {
        const tool = new SetSkillResourceTool(registry);
        vi.spyOn(Skill.prototype, 'setResource').mockRejectedValue(new Error('disk full'));
        const result = await tool.execute({
            skill_name: 'my_skill',
            resource_name: 'references/guide.md',
            content: 'test'
        });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('disk full');
    });
});
