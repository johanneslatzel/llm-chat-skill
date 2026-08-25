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
        const result = await tool.execute({ skill_name: 'my_skill', resourceType: 'references', name: 'guide.md' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toBe('Guide content');
    });

    it('reports error for missing skill_name parameter', async () => {
        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ resourceType: 'references', name: 'guide.md' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('skill_name');
    });

    it('reports error for missing resourceType parameter', async () => {
        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'my_skill', name: 'guide.md' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('resourceType');
    });

    it('reports error for missing name parameter', async () => {
        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'my_skill', resourceType: 'references' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('name');
    });

    it('reports error for unknown skill', async () => {
        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'nonexistent', resourceType: 'references', name: 'guide.md' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('not found');
    });

    it('reports error for invalid resource type', async () => {
        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'my_skill', resourceType: 'other', name: 'secret.txt' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('not found');
    });

    it('reports error for resource not found in skill', async () => {
        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'my_skill', resourceType: 'references', name: 'missing.md' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('not found');
    });

    it('lists available identifiers when a reference is not found', async () => {
        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'my_skill', resourceType: 'references', name: 'missing.md' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('not found');
        expect(result[0]!.result).toContain("Available references in 'my_skill': guide.md");
    });

    it('truncates the available-identifiers hint when many resources exist', async () => {
        const s = registry.get('my_skill')!;
        for (let i = 0; i < 10; i++) {
            await s.setResource('references', `ref-${i}.md`, `content ${i}`);
        }

        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'my_skill', resourceType: 'references', name: 'missing.md' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('(truncated)');
        const line = result[0]!.result
            .split('\n')
            .find((l) => l.startsWith('Available references'));
        expect(line).toContain('ref-0.md');
        expect(line).toContain('ref-6.md');
        expect(line).not.toContain('ref-7.md');
        expect(line).not.toContain('ref-9.md');
    });

    it('uses the configured max hint resource names', async () => {
        const config = new SkillRegistryConfiguration(tmpDir, undefined, 3);
        const reg = new SkillRegistry(config);
        await reg.initialize();
        await reg.createSkill(
            'small_skill',
            'A sufficiently long description for testing',
            'B'.repeat(300)
        );
        const s = reg.get('small_skill')!;
        for (let i = 0; i < 5; i++) {
            await s.setResource('references', `ref-${i}.md`, `content ${i}`);
        }

        const tool = new GetSkillResourceTool(reg);
        const result = await tool.execute({ skill_name: 'small_skill', resourceType: 'references', name: 'missing.md' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('(truncated)');
        const line = result[0]!.result
            .split('\n')
            .find((l) => l.startsWith('Available references'));
        expect(line).toContain('ref-0.md');
        expect(line).toContain('ref-2.md');
        expect(line).not.toContain('ref-3.md');
    });

    it('omits the available-identifiers hint when the skill has none of that type', async () => {
        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'my_skill', resourceType: 'assets', name: 'missing.json' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toBe(
            "Resource 'missing.json' of type 'assets' not found in skill 'my_skill'."
        );
    });

    it('lists section identifiers when a section is not found', async () => {
        await registry.createSkill('struct_skill', 'A sufficiently long description for testing', '');
        const s = registry.get('struct_skill')!;
        await s.setResource('sections', 'purpose.md', '# Purpose');
        await s.setResource('sections', 'workflow.md', '# Workflow');

        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'struct_skill', resourceType: 'sections', name: 'missing.md' });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain("Available sections in 'struct_skill': purpose.md, workflow.md");
    });

    it('reads a section file from a structured skill', async () => {
        await registry.createSkill('struct_skill', 'A sufficiently long description for testing', '');
        const s = registry.get('struct_skill')!;
        await s.setResource('sections', 'workflow.md', '# Workflow\n\nStep 1: do stuff');

        const tool = new GetSkillResourceTool(registry);
        const result = await tool.execute({ skill_name: 'struct_skill', resourceType: 'sections', name: 'workflow.md' });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toBe('# Workflow\n\nStep 1: do stuff');
    });
});
