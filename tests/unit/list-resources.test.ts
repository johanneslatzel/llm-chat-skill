import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillRegistry, SkillRegistryConfiguration, ListResourcesTool } from '../../src/index.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';
import { createTempDir, removeTempDir, createTempDirStructure } from '../index.js';

function makeSkillFile(name: string, description: string, body: string): string {
    return `---
name: ${name}
description: ${description}
---
${body}`;
}

describe('ListResourcesTool', () => {
    let tmpDir: string;
    let registry: SkillRegistry;

    beforeEach(async () => {
        tmpDir = createTempDir();
        createTempDirStructure(tmpDir, {
            'alpha/SKILL.md': makeSkillFile('alpha', 'Alpha skill', 'alpha body'),
            'beta/SKILL.md': makeSkillFile('beta', 'Beta skill', 'beta body'),
        });
        const config = new SkillRegistryConfiguration(tmpDir);
        registry = new SkillRegistry(config);
        await registry.initialize();

        const alpha = registry.get('alpha')!;
        await alpha.setResource('references', 'guide.md', 'guide content');
        await alpha.setResource('references', 'notes.md', 'notes content');
        await alpha.setResource('assets', 'config.json', '{}');

        const beta = registry.get('beta')!;
        await beta.setResource('references', 'manual.md', 'manual content');
    });

    afterEach(() => {
        removeTempDir(tmpDir);
    });

    it('lists resources across all skills', async () => {
        const tool = new ListResourcesTool(registry);
        const result = await tool.execute({});
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('Resources across 2 skills');
        expect(result[0]!.result).toContain('alpha:');
        expect(result[0]!.result).toContain('beta:');
        expect(result[0]!.result).toContain('Total: 4 resources');
    });

    it('lists resources for a specific skill', async () => {
        const tool = new ListResourcesTool(registry);
        const result = await tool.execute({ skill_name: 'alpha' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('Resources for alpha');
        expect(result[0]!.result).toContain('alpha:');
        expect(result[0]!.result).toContain('- references:');
        expect(result[0]!.result).toContain('- assets:');
        expect(result[0]!.result).not.toContain('beta');
        expect(result[0]!.result).toContain('Total: 3 resources');
    });

    it('filters by resource_type', async () => {
        const tool = new ListResourcesTool(registry);
        const result = await tool.execute({ resource_type: 'assets' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('alpha:');
        expect(result[0]!.result).toContain('assets:');
        expect(result[0]!.result).not.toContain('references:');
        expect(result[0]!.result).not.toContain('beta');
        expect(result[0]!.result).toContain('Total: 1 resource');
    });

    it('returns error for invalid resource_type value', async () => {
        const tool = new ListResourcesTool(registry);
        const result = await tool.execute({ resource_type: 'bogus' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('Invalid resource_type');
    });

    it('returns error for invalid skill_name type', async () => {
        const tool = new ListResourcesTool(registry);
        const result = await tool.execute({ skill_name: true });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('skill_name');
    });

    it('returns error for invalid resource_type type', async () => {
        const tool = new ListResourcesTool(registry);
        const result = await tool.execute({ resource_type: null });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('resource_type');
    });

    it('returns error for unknown skill', async () => {
        const tool = new ListResourcesTool(registry);
        const result = await tool.execute({ skill_name: 'nonexistent' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('not found');
    });

    it('returns no resources message when skill has none', async () => {
        const longBody = 'B'.repeat(300);
        await registry.createSkill('empty_skill', 'A sufficiently long description for testing', longBody);
        const tool = new ListResourcesTool(registry);
        const result = await tool.execute({ skill_name: 'empty_skill' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('No resources found');
    });

    it('returns no resources message when no skills have resources of filtered type', async () => {
        const tool = new ListResourcesTool(registry);
        const result = await tool.execute({ resource_type: 'sections' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('No resources found across any skill');
    });

    it('handles skills with only references', async () => {
        const tool = new ListResourcesTool(registry);
        const result = await tool.execute({ skill_name: 'beta' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('- references:');
        expect(result[0]!.result).toContain('- manual.md');
        expect(result[0]!.result).not.toContain('- assets:');
        expect(result[0]!.result).toContain('Total: 1 resource');
    });
});
