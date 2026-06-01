import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillRegistry, SkillRegistryConfiguration, DeleteSkillTool } from '../../src/index.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';
import { createTempDir, removeTempDir, createTempDirStructure } from '../index.js';

function makeSkillFile(name: string, description: string, body: string): string {
    return `---
name: ${name}
description: ${description}
---
${body}`;
}

describe('DeleteSkillTool', () => {
    let tmpDir: string;
    let registry: SkillRegistry;

    beforeEach(async () => {
        tmpDir = createTempDir();
        createTempDirStructure(tmpDir, {
            'existing/SKILL.md': makeSkillFile('existing', 'Existing skill', 'Existing body')
        });
        const config = new SkillRegistryConfiguration(tmpDir);
        registry = new SkillRegistry(config);
        await registry.initialize();
    });

    afterEach(() => {
        removeTempDir(tmpDir);
    });

    it('deletes a skill', async () => {
        const tool = new DeleteSkillTool(registry);
        const result = await tool.execute({
            name: 'existing'
        });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('deleted');
        expect(registry.get('existing')).toBeUndefined();
    });

    it('reports error for missing name', async () => {
        const tool = new DeleteSkillTool(registry);
        const result = await tool.execute({});
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('name');
    });

    it('reports error for unknown skill', async () => {
        const tool = new DeleteSkillTool(registry);
        const result = await tool.execute({
            name: 'nonexistent'
        });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('not found');
    });
});
