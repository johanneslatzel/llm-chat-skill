import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillRegistry, SkillRegistryConfiguration, SkillResource, LoadSkillTool } from '../../src/index.js';
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
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toBe('Full skill body');
    });

    it('appends resource listing when resources exist', async () => {
        const s = registry.get('my_skill')!;
        await s.setResource(SkillResource.References, 'guide.md', 'content');
        await s.setResource(SkillResource.Assets, 'template.json', '{}');

        const tool = new LoadSkillTool(registry);
        const result = await tool.execute({ name: 'my_skill' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('--- Resources ---');
        expect(result.result).toContain('references/guide.md');
        expect(result.result).toContain('assets/template.json');
    });

    it('reports error for missing name parameter', async () => {
        const tool = new LoadSkillTool(registry);
        const result = await tool.execute({});
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('name');
    });

    it('reports error for unknown skill', async () => {
        const tool = new LoadSkillTool(registry);
        const result = await tool.execute({ name: 'nonexistent' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('not found');
    });
});
