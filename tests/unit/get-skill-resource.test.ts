import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillRegistry, SkillRegistryConfiguration, GetSkillResourceTool } from '../../src/index.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';
import { createTempDir, removeTempDir, createTempDirStructure } from '../index.js';

function makeSkillFile(name: string, description: string, body: string): string {
    return `---
name: ${name}
description: ${description}
---
${body}`;
}

describe('GetSkillResourceTool', () => {
    let tmpDir: string;
    let registry: SkillRegistry;

    beforeEach(async () => {
        tmpDir = createTempDir();
        createTempDirStructure(tmpDir, {
            'my_skill/SKILL.md': makeSkillFile('my_skill', 'Test skill', 'body'),
            'my_skill/references/guide.md': 'Guide content'
        });
        const config = new SkillRegistryConfiguration(tmpDir);
        registry = new SkillRegistry(config);
        await registry.initialize();
    });

    afterEach(() => {
        removeTempDir(tmpDir);
    });

    it('reads a skill reference file', async () => {
        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'my_skill', resource_name: 'references/guide.md' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toBe('Guide content');
    });

    it('reports error for missing skill_name parameter', async () => {
        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ resource_name: 'references/guide.md' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('skill_name');
    });

    it('reports error for missing resource_name parameter', async () => {
        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'my_skill' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('resource_name');
    });

    it('reports error for unknown skill', async () => {
        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'nonexistent', resource_name: 'references/guide.md' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('not found');
    });

    it('reports error for invalid resource specification', async () => {
        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'my_skill', resource_name: 'other/secret.txt' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('references');
    });

    it('reports error for resource not found in skill', async () => {
        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'my_skill', resource_name: 'references/missing.md' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('not found');
    });
});
