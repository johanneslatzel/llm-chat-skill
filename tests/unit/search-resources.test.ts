import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SkillRegistry, SkillRegistryConfiguration, SearchResourcesTool, Skill } from '../../src/index.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';
import { createTempDir, removeTempDir, createTempDirStructure } from '../index.js';

function makeSkillFile(name: string, description: string, body: string): string {
    return `---
name: ${name}
description: ${description}
---
${body}`;
}

describe('SearchResourcesTool', () => {
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
        await alpha.setResource('references', 'guide.md', 'This is the deploy guide.\nFollow the deployment steps.\nMore info here.');
        await alpha.setResource('references', 'notes.md', 'Just some notes.\nNothing relevant here.');
        await alpha.setResource('assets', 'config.json', '{"deploy": true}');

        const beta = registry.get('beta')!;
        await beta.setResource('references', 'manual.md', 'Manual has deploy steps.\nAnd more details.');
        await beta.setResource('assets', 'script.sh', '#!/bin/bash\necho "no matches here"');
    });

    afterEach(() => {
        removeTempDir(tmpDir);
    });

    it('returns matching lines for a simple query', async () => {
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: 'deploy' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('alpha (references/guide.md)');
        expect(result[0]!.result).toContain('line 1: This is the deploy guide');
        expect(result[0]!.result).toContain('line 2: Follow the deployment steps');
        expect(result[0]!.result).toContain('alpha (assets/config.json)');
        expect(result[0]!.result).toContain('beta (references/manual.md)');
        expect(result[0]!.result).not.toContain('alpha (references/notes.md)');
        expect(result[0]!.result).not.toContain('beta (assets/script.sh)');
        expect(result[0]!.result).toContain('4 matches across 2 skills');
    });

    it('matches case-insensitively', async () => {
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: 'DEPLOY' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('alpha (references/guide.md)');
        expect(result[0]!.result).toContain('beta (references/manual.md)');
    });

    it('supports regex patterns', async () => {
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: 'deploy(?:ment)?' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('line 1: This is the deploy guide');
        expect(result[0]!.result).toContain('line 2: Follow the deployment steps');
    });

    it('filters by skill_name', async () => {
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: 'deploy', skill_name: 'alpha' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('alpha');
        expect(result[0]!.result).not.toContain('beta');
        expect(result[0]!.result).toContain('1 skill');
    });

    it('filters by resource_type', async () => {
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: 'deploy', resource_type: 'assets' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('assets/config.json');
        expect(result[0]!.result).not.toContain('references');
    });

    it('returns error for missing query', async () => {
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({});
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('query');
    });

    it('returns error for whitespace-only query', async () => {
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: '   ' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('query');
    });

    it('returns error for invalid regex', async () => {
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: '[invalid' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('Invalid regex');
    });

    it('returns error for invalid skill_name type', async () => {
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: 'deploy', skill_name: 123 });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('skill_name');
    });

    it('returns error for invalid resource_type type', async () => {
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: 'deploy', resource_type: 456 });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('resource_type');
    });

    it('returns error for unknown skill', async () => {
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: 'deploy', skill_name: 'nonexistent' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('not found');
    });

    it('returns error for invalid resource_type value', async () => {
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: 'deploy', resource_type: 'invalid' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('Invalid resource_type');
    });

    it('returns no matches message when nothing is found', async () => {
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: 'xyznonexistent' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('No matches found');
    });

    it('handles sections resources', async () => {
        await registry.createSkill('struct', 'A sufficiently long description for testing', '');
        const s = registry.get('struct')!;
        await s.setResource('sections', 'purpose.md', '# Purpose\nThis skill deploys things.');
        await s.setResource('sections', 'workflow.md', '# Workflow\nRun the deploy command.');

        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: 'deploy', skill_name: 'struct' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('sections/purpose.md');
        expect(result[0]!.result).toContain('sections/workflow.md');
    });

    it('returns singular "match" and "skill" for single result', async () => {
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: 'xyznonexistent', skill_name: 'alpha' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('No matches found');
    });

    it('handles getResource returning null gracefully', async () => {
        const spy = vi.spyOn(Skill.prototype, 'getResource').mockResolvedValue(null);
        const tool = new SearchResourcesTool(registry);
        const result = await tool.execute({ query: 'deploy' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('No matches found');
        spy.mockRestore();
    });
});
