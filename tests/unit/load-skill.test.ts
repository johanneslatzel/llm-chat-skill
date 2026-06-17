import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillRegistry, SkillRegistryConfiguration, LoadSkillTool } from '../../src/index.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';
import { createTempDir, removeTempDir, createTempDirStructure } from '../index.js';

function makeSkillFile(name: string, description: string, body: string): string {
    return `---
name: ${name}
description: ${description}
---
${body}`;
}

describe('LoadSkillTool', () => {
    let tmpDir: string;
    let registry: SkillRegistry;

    beforeEach(async () => {
        tmpDir = createTempDir();
        createTempDirStructure(tmpDir, {
            'my_skill/SKILL.md': makeSkillFile('my_skill', 'Test skill', 'Full skill body')
        });
        const config = new SkillRegistryConfiguration(tmpDir);
        registry = new SkillRegistry(config);
        await registry.initialize();
    });

    afterEach(() => {
        removeTempDir(tmpDir);
    });

    it('returns skill body for valid name', async () => {
        const tool = new LoadSkillTool(registry);
        const result = await tool.execute({ name: 'my_skill' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toBe('Full skill body');
    });

    it('appends resource listing when resources exist', async () => {
        const s = registry.get('my_skill')!;
        await s.setResource('references', 'guide.md', 'content');
        await s.setResource('assets', 'template.json', '{}');

        const tool = new LoadSkillTool(registry);
        const result = await tool.execute({ name: 'my_skill' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('--- Resources ---');
        expect(result[0]!.result).toContain('references/guide.md');
        expect(result[0]!.result).toContain('assets/template.json');
    });

    it('reports error for missing name parameter', async () => {
        const tool = new LoadSkillTool(registry);
        const result = await tool.execute({});
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('name');
    });

    it('reports error for unknown skill', async () => {
        const tool = new LoadSkillTool(registry);
        const result = await tool.execute({ name: 'nonexistent' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('not found');
    });

    it('loads a structured skill and returns composed body', async () => {
        await registry.createSkill('struct_skill', 'A sufficiently long description for testing', '');
        const s = registry.get('struct_skill')!;
        await s.setResource('sections', 'purpose.md', '# My Purpose');
        await s.setResource('sections', 'workflow.md', '# My Workflow');

        const tool = new LoadSkillTool(registry);
        const result = await tool.execute({ name: 'struct_skill' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('Purpose');
        expect(result[0]!.result).toContain('My Purpose');
        expect(result[0]!.result).toContain('Workflow');
        expect(result[0]!.result).toContain('My Workflow');
    });

    it('appends sections resources to listing', async () => {
        await registry.createSkill('struct_skill', 'A sufficiently long description for testing', '');
        const s = registry.get('struct_skill')!;
        await s.setResource('sections', 'examples.md', '# Examples');

        const tool = new LoadSkillTool(registry);
        const result = await tool.execute({ name: 'struct_skill' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('--- Resources ---');
        expect(result[0]!.result).toContain('sections/examples.md');
    });
});
