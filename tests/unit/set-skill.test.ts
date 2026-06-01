import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkillRegistry, SkillRegistryConfiguration, SetSkillTool } from '../../src/index.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';
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

describe('SetSkillTool', () => {
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

    describe('create', () => {
        it('creates a skill successfully', async () => {
            const tool = new SetSkillTool(registry);
            const result = await tool.execute({
                name: 'new_skill',
                description: VALID_DESC,
                body: VALID_BODY
            });
            expect(result.status).toBe(ResultStatus.Success);
            expect(result.result).toContain('created successfully');

            const skill = registry.get('new_skill');
            expect(skill).toBeDefined();
            expect(skill!.description).toBe(VALID_DESC);
            expect(skill!.body).toBe(VALID_BODY);
        });

        it('reports error when body is missing for new skill', async () => {
            const tool = new SetSkillTool(registry);
            const result = await tool.execute({
                name: 'new_skill',
                description: VALID_DESC
            });
            expect(result.status).toBe(ResultStatus.Error);
            expect(result.result).toContain('body');
        });

        it('reports error when description is missing for new skill', async () => {
            const tool = new SetSkillTool(registry);
            const result = await tool.execute({
                name: 'no_desc'
            });
            expect(result.status).toBe(ResultStatus.Error);
            expect(result.result).toContain('description');
        });
    });

    describe('update', () => {
        it('updates description', async () => {
            const tool = new SetSkillTool(registry);
            const result = await tool.execute({
                name: 'existing',
                description: 'Updated description of the existing skill'
            });
            expect(result.status).toBe(ResultStatus.Success);
            expect(result.result).toContain('description');
            expect(registry.get('existing')!.description).toBe('Updated description of the existing skill');
        });

        it('updates body', async () => {
            const tool = new SetSkillTool(registry);
            const result = await tool.execute({
                name: 'existing',
                body: VALID_BODY
            });
            expect(result.status).toBe(ResultStatus.Success);
            expect(result.result).toContain('body');
            expect(registry.get('existing')!.body).toBe(VALID_BODY);
        });

        it('renames skill', async () => {
            const tool = new SetSkillTool(registry);
            const result = await tool.execute({
                name: 'existing',
                new_name: 'renamed'
            });
            expect(result.status).toBe(ResultStatus.Success);
            expect(result.result).toContain('renamed');
            expect(registry.get('existing')).toBeUndefined();
            expect(registry.get('renamed')).toBeDefined();
        });

        it('reports error when no update fields provided', async () => {
            const tool = new SetSkillTool(registry);
            const result = await tool.execute({
                name: 'existing'
            });
            expect(result.status).toBe(ResultStatus.Error);
            expect(result.result).toContain('At least one');
        });

        it('reports error for unknown skill on update', async () => {
            // A non-existent skill triggers create, so this tests missing description
            const tool = new SetSkillTool(registry);
            const result = await tool.execute({
                name: 'nonexistent'
            });
            expect(result.status).toBe(ResultStatus.Error);
            expect(result.result).toContain('description');
        });
    });

    it('reports error for missing name parameter', async () => {
        const tool = new SetSkillTool(registry);
        const result = await tool.execute({});
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('name');
    });

    it('handles unexpected error during execution', async () => {
        const tool = new SetSkillTool(registry);
        vi.spyOn(registry, 'createSkill').mockRejectedValue(new Error('unexpected error'));
        const result = await tool.execute({
            name: 'new_skill',
            description: 'test',
            body: VALID_BODY
        });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('unexpected error');
    });
});
