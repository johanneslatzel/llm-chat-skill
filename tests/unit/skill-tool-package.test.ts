import { describe, it, expect } from 'vitest';
import { SkillToolPackage, SkillRegistry } from '../../src/index.js';

describe('SkillToolPackage', () => {
    it('delivers all eight tools', () => {
        const registry = new SkillRegistry();
        const pkg = new SkillToolPackage(registry);
        const tools = pkg.tools();
        expect(tools).toHaveLength(8);

        const names = tools.map((t) => t.name).sort();
        expect(names).toEqual([
            'delete_skill',
            'delete_skill_resource',
            'get_skill_resource',
            'list_resources',
            'load_skill',
            'search_resources',
            'set_skill',
            'set_skill_resource'
        ]);
    });

    it('tutorial returns skill-guide content', () => {
        const registry = new SkillRegistry();
        const pkg = new SkillToolPackage(registry);
        const tutorial = pkg.tutorial();
        expect(tutorial).toBeTruthy();
        expect(tutorial).toContain('Skill System Usage Guide');
    });

    it('composeTutorial includes tool names and guide content', () => {
        const registry = new SkillRegistry();
        const pkg = new SkillToolPackage(registry);
        const composed = pkg.tutorial();
        expect(composed).toContain('load_skill');
        expect(composed).toContain('Skill System Usage Guide');
    });
});

