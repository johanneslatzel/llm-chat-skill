import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkillRegistry, SkillRegistryConfiguration, Skill, SetSkillResourceTool, SetSkillTool } from '../../src/index.js';
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
        vi.restoreAllMocks();
    });

    it('writes a reference file', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resourceType: 'references',
            name: 'guide.md',
            content: 'Guide content'
        });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('written');

        const skill = registry.get('my_skill')!;
        const content = await skill.getResource('references', 'guide.md');
        expect(content).toBe('Guide content');
    });

    it('writes an asset file', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resourceType: 'assets',
            name: 'template.json',
            content: '{"key": "value"}'
        });
        expect(result[0]!.status).toBe(ResultStatus.Success);
    });

    it('reports error when content is missing', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resourceType: 'references',
            name: 'guide.md'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('content');
    });

    it('reports error for missing skill_name', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            resourceType: 'references',
            name: 'guide.md',
            content: 'test'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('skill_name');
    });

    it('reports error for missing resourceType', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            name: 'guide.md',
            content: 'test'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('resourceType');
    });

    it('reports error for missing name', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resourceType: 'references',
            content: 'test'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('name');
    });

    it('reports error for unknown skill', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'nonexistent',
            resourceType: 'references',
            name: 'guide.md',
            content: 'test'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('not found');
    });

    it('reports error for invalid resource type', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resourceType: 'other',
            name: 'secret.txt',
            content: 'test'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('Only resources of type references, assets, or sections can be written');
    });

    it('handles filesystem error during write', async () => {
        const tool = new SetSkillResourceTool(registry);
        vi.spyOn(Skill.prototype, 'setResource').mockRejectedValue(new Error('disk full'));
        const result = await tool.execute({
            skill_name: 'my_skill',
            resourceType: 'references',
            name: 'guide.md',
            content: 'test'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('disk full');
    });

    it('writes a section file to a structured skill', async () => {
        // Create a structured skill via SetSkillTool (normal user path)
        const setTool = new SetSkillTool(registry);
        const createResult = await setTool.execute({
            name: 'struct_skill',
            description: 'A sufficiently long description for testing'
        });
        expect(createResult[0]!.status).toBe(ResultStatus.Success);
        expect(createResult[0]!.result).toContain('Structured skill');

        const skill = registry.get('struct_skill')!;
        expect(skill.isStructured).toBe(true);

        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'struct_skill',
            resourceType: 'sections',
            name: 'purpose.md',
            content: '# Purpose\n\nThis is the purpose.'
        });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('written');

        const content = await skill.getResource('sections', 'purpose.md');
        expect(content).toBe('# Purpose\n\nThis is the purpose.');
        // Body should be recomposed
        expect(skill.body).toContain('Purpose');
    });

    it('reports error when writing sections to a plain skill', async () => {
        const tool = new SetSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resourceType: 'sections',
            name: 'purpose.md',
            content: '# Purpose'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('not a structured skill');
    });
});
