import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BodyFormat, SkillRegistry, SkillRegistryConfiguration, Skill } from '../../src/index.js';
import { createTempDir, removeTempDir, createTempDirStructure } from '../index.js';

function makeSkillFile(name: string, description: string, body: string): string {
    return `---
name: ${name}
description: ${description}
---
${body}`;
}

describe('Skill.frontmatter', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTempDir();
    });

    afterEach(() => {
        removeTempDir(tmpDir);
    });

    it('returns YAML without delimiters', () => {
        const skill = new Skill('test', 'A sufficiently long description for testing', 'body', tmpDir);
        const fm = skill.frontmatter();
        expect(fm).toContain('name: test');
        expect(fm).toContain('description: A sufficiently long description for testing');
        expect(fm).not.toContain('---');
    });

    it('includes tags when present', () => {
        const skill = new Skill('test', 'A sufficiently long description for testing', 'body', tmpDir);
        skill.tags = ['alpha', 'beta'];
        const fm = skill.frontmatter();
        expect(fm).toContain('tags:');
        expect(fm).toContain('alpha');
        expect(fm).toContain('beta');
    });

    it('includes body-format for structured skills', () => {
        const skill = new Skill('test', 'A sufficiently long description for testing', '', tmpDir);
        skill.metadataBodyFormat = BodyFormat.Structured;
        const fm = skill.frontmatter();
        expect(fm).toContain('body-format: structured');
    });

    it('omits metadata when no tags and not structured', () => {
        const skill = new Skill('test', 'A sufficiently long description for testing', 'body', tmpDir);
        const fm = skill.frontmatter();
        expect(fm).not.toContain('metadata:');
    });
});

describe('SkillRegistry.frontmatterListing', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTempDir();
    });

    afterEach(() => {
        removeTempDir(tmpDir);
    });

    it('returns empty string when no skills', async () => {
        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();
        expect(registry.frontmatterListing()).toBe('');
    });

    it('returns multi-document YAML for loaded skills', async () => {
        createTempDirStructure(tmpDir, {
            'alpha/SKILL.md': makeSkillFile('alpha', 'Alpha skill for testing', 'A body'),
            'beta/SKILL.md': makeSkillFile('beta', 'Beta skill for testing', 'B body'),
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const listing = registry.frontmatterListing();
        const docs = listing.split('---\n').filter((d) => d.trim().length > 0);
        expect(docs).toHaveLength(2);
        expect(listing).toContain('name: alpha');
        expect(listing).toContain('name: beta');
        expect(listing).toContain('description: Alpha skill for testing');
        expect(listing).toContain('description: Beta skill for testing');
    });

    it('sorts skills alphabetically', async () => {
        createTempDirStructure(tmpDir, {
            'zebra/SKILL.md': makeSkillFile('zebra', 'Zebra skill for testing', 'Z body'),
            'apple/SKILL.md': makeSkillFile('apple', 'Apple skill for testing', 'A body'),
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const listing = registry.frontmatterListing();
        const applePos = listing.indexOf('name: apple');
        const zebraPos = listing.indexOf('name: zebra');
        expect(applePos).toBeLessThan(zebraPos);
    });

    it('includes tags in each skill block', async () => {
        createTempDirStructure(tmpDir, {
            'tagged/SKILL.md': makeSkillFile('tagged', 'A tagged skill for testing', 'body'),
        });

        const config = new SkillRegistryConfiguration(tmpDir);
        const registry = new SkillRegistry(config);
        await registry.initialize();

        const skill = registry.get('tagged')!;
        skill.tags = ['deploy', 'ops'];

        const listing = registry.frontmatterListing();
        expect(listing).toContain('tags:');
        expect(listing).toContain('deploy');
        expect(listing).toContain('ops');
    });
});
