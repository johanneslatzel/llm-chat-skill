import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkillRegistry, SkillRegistryConfiguration, Skill, DeleteSkillResourceTool, SetSkillTool } from '../../src/index.js';
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
        vi.restoreAllMocks();
    });

    it('deletes a file', async () => {
        const s = registry.get('my_skill')!;
        await s.setResource('references', 'guide.md', 'content');

        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resourceType: 'references',
            name: 'guide.md'
        });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('deleted');

        const skill = registry.get('my_skill')!;
        const content = await skill.getResource('references', 'guide.md');
        expect(content).toBeNull();
    });

    it('succeeds when file does not exist', async () => {
        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resourceType: 'references',
            name: 'missing.md'
        });
        expect(result[0]!.status).toBe(ResultStatus.Success);
    });

    it('reports error for missing skill_name', async () => {
        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            resourceType: 'references',
            name: 'guide.md'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('skill_name');
    });

    it('reports error for missing resourceType', async () => {
        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            name: 'guide.md'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('resourceType');
    });

    it('reports error for missing name', async () => {
        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resourceType: 'references'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('name');
    });

    it('reports error for unknown skill', async () => {
        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'nonexistent',
            resourceType: 'references',
            name: 'guide.md'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('not found');
    });

    it('reports error for invalid resource type', async () => {
        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resourceType: 'other',
            name: 'secret.txt'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('Only resources of type references, assets, or sections can be deleted');
    });

    it('handles filesystem error during deletion', async () => {
        const tool = new DeleteSkillResourceTool(registry);
        vi.spyOn(Skill.prototype, 'deleteResource').mockRejectedValue(new Error('permission denied'));
        const result = await tool.execute({
            skill_name: 'my_skill',
            resourceType: 'references',
            name: 'guide.md'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('permission denied');
    });

    it('deletes a section file from a structured skill', async () => {
        const setTool = new SetSkillTool(registry);
        const createResult = await setTool.execute({
            name: 'struct_skill',
            description: 'A sufficiently long description for testing'
        });
        expect(createResult[0]!.status).toBe(ResultStatus.Success);

        const s = registry.get('struct_skill')!;
        await s.setResource('sections', 'purpose.md', '# Purpose');
        // Verify it was written
        expect(await s.getResource('sections', 'purpose.md')).toBe('# Purpose');

        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'struct_skill',
            resourceType: 'sections',
            name: 'purpose.md'
        });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('deleted');
        // File should be gone
        expect(await s.getResource('sections', 'purpose.md')).toBeNull();
    });

    it('reports error when deleting sections from a plain skill', async () => {
        const tool = new DeleteSkillResourceTool(registry);
        const result = await tool.execute({
            skill_name: 'my_skill',
            resourceType: 'sections',
            name: 'purpose.md'
        });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('not a structured skill');
    });
});
