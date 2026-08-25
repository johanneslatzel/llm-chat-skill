import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BodyFormat, Skill } from '../../src/index.js';
import { demoteHeadings } from '../../src/lib/skill.js';
import { createTempDir, removeTempDir } from '../index.js';

describe('Skill.serialize', () => {
    it('formats empty body without extra newlines', () => {
        const skill = new Skill('test', 'A sufficiently long description for testing', '', '/tmp');
        const output = skill.serialize();
        expect(output).toBe('---\nname: test\ndescription: A sufficiently long description for testing\n---\n');
    });

    it('includes metadata tags', () => {
        const skill = new Skill('test', 'A sufficiently long description for testing', 'body', '/tmp');
        skill.tags = ['deploy', 'ops'];
        const output = skill.serialize();
        expect(output).toContain('metadata:');
        expect(output).toContain('tags:');
        expect(output).toContain('deploy');
        expect(output).toContain('ops');
    });

    it('includes body-format for structured skills', () => {
        const skill = new Skill('test', 'A sufficiently long description for testing', '', '/tmp');
        skill.metadataBodyFormat = BodyFormat.Structured;
        const output = skill.serialize();
        expect(output).toContain('metadata:');
        expect(output).toContain('body-format: structured');
    });

    it('omits metadata when tags are empty and body-format is plain', () => {
        const skill = new Skill('test', 'A sufficiently long description for testing', 'body', '/tmp');
        const output = skill.serialize();
        expect(output).not.toContain('metadata:');
    });
});

describe('demoteHeadings', () => {
    it('shifts ATX headings up one level by default', () => {
        expect(demoteHeadings('# Title')).toBe('## Title');
        expect(demoteHeadings('## Sub')).toBe('### Sub');
        expect(demoteHeadings('### Sub')).toBe('#### Sub');
        expect(demoteHeadings('#### Sub')).toBe('##### Sub');
        expect(demoteHeadings('##### Sub')).toBe('###### Sub');
    });

    it('shifts ATX headings up multiple levels', () => {
        expect(demoteHeadings('# Title', 2)).toBe('### Title');
        expect(demoteHeadings('## Sub', 2)).toBe('#### Sub');
        expect(demoteHeadings('### Sub', 2)).toBe('##### Sub');
        expect(demoteHeadings('#### Sub', 2)).toBe('###### Sub');
    });

    it('caps at ######', () => {
        expect(demoteHeadings('###### Deep')).toBe('###### Deep');
        expect(demoteHeadings('###### Deep', 2)).toBe('###### Deep');
        expect(demoteHeadings('##### Deep', 2)).toBe('###### Deep');
        expect(demoteHeadings('#### Deep', 3)).toBe('###### Deep');
    });

    it('skips headings inside fenced code blocks', () => {
        const input = 'text\n```\n# inside code\n```\n# outside code';
        expect(demoteHeadings(input)).toBe('text\n```\n# inside code\n```\n## outside code');
        expect(demoteHeadings(input, 2)).toBe('text\n```\n# inside code\n```\n### outside code');
    });

    it('handles mixed content and preserves non-heading lines', () => {
        const input = 'Paragraph text\n\n## Existing Sub\n\n- list item\n\nMore text';
        const result = demoteHeadings(input);
        expect(result).toContain('### Existing Sub');
        expect(result).toContain('Paragraph text');
        expect(result).toContain('- list item');
        expect(result).toContain('More text');
    });
});

describe('Skill.parse', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTempDir();
    });

    afterEach(() => {
        removeTempDir(tmpDir);
    });

    it('returns null for content without frontmatter', () => {
        const result = Skill.parse('no frontmatter here', tmpDir);
        expect(result).toBeNull();
    });

    it('returns null for invalid YAML in frontmatter', () => {
        const result = Skill.parse('---\n{invalid: yaml:\n---\nbody', tmpDir);
        expect(result).toBeNull();
    });

    it('returns null for non-object YAML', () => {
        const result = Skill.parse('---\n"just a string"\n---\nbody', tmpDir);
        expect(result).toBeNull();
    });

    it('returns null when name or description is missing', () => {
        const result = Skill.parse('---\nname: only_name\n---\nbody', tmpDir);
        expect(result).toBeNull();
    });

    it('returns null when name or description is empty', () => {
        const result = Skill.parse('---\nname: \ndescription: \n---\nbody', tmpDir);
        expect(result).toBeNull();
    });

    it('reads body-format: structured from metadata', () => {
        const content = `---
name: structured
description: A structured skill for testing
metadata:
  body-format: structured
---
`;
        const skill = Skill.parse(content, tmpDir);
        expect(skill).not.toBeNull();
        expect(skill!.isStructured).toBe(true);
        expect(skill!.metadataBodyFormat).toBe(BodyFormat.Structured);
    });

    it('handles non-array tags gracefully', () => {
        const content = `---
name: tagged
description: A skill with weird tags
metadata:
  tags: "not an array"
---
body
`;
        const skill = Skill.parse(content, tmpDir);
        expect(skill).not.toBeNull();
        expect(skill!.tags).toEqual([]);
    });

    it('handles valid tags', () => {
        const content = `---
name: tagged
description: A skill with tags
metadata:
  tags:
    - deploy
    - ops
---
body
`;
        const skill = Skill.parse(content, tmpDir);
        expect(skill).not.toBeNull();
        expect(skill!.tags).toEqual(['deploy', 'ops']);
    });
});
