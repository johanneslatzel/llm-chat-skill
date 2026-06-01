import { describe, it, expect, vi, afterEach } from 'vitest';
import { SkillRegistryConfiguration, WarningMode } from '../../src/index.js';

describe('SkillRegistryConfiguration', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('reads from LLM_CHAT_SKILL_DIR env var', async () => {
        vi.stubEnv('LLM_CHAT_SKILL_DIR', '/from/env');
        const config = new SkillRegistryConfiguration();
        expect(config.skillDir).toBe('/from/env');
    });

    it('constructor override takes precedence over env var', async () => {
        vi.stubEnv('LLM_CHAT_SKILL_DIR', '/from/env');
        const config = new SkillRegistryConfiguration('/override');
        expect(config.skillDir).toBe('/override');
    });

    it('uses the env var default when no dir is provided', async () => {
        const config = new SkillRegistryConfiguration();
        expect(config.skillDir).toBe('');
    });

    it('overrides the directory when provided', async () => {
        const config = new SkillRegistryConfiguration('/some/path');
        expect(config.skillDir).toBe('/some/path');
    });

    it('defaults to silent warning mode', async () => {
        const config = new SkillRegistryConfiguration();
        expect(config.warnings).toBe(WarningMode.Silent);
    });

    it('overrides warning mode when provided', async () => {
        const config = new SkillRegistryConfiguration(undefined, WarningMode.Error);
        expect(config.warnings).toBe(WarningMode.Error);
    });

    it('reads warning mode from env var', async () => {
        vi.stubEnv('LLM_CHAT_SKILL_WARNINGS', 'silent');
        const config = new SkillRegistryConfiguration();
        expect(config.warnings).toBe(WarningMode.Silent);
    });

    it('constructor override takes precedence over env var for warnings', async () => {
        vi.stubEnv('LLM_CHAT_SKILL_WARNINGS', 'silent');
        const config = new SkillRegistryConfiguration(undefined, WarningMode.Error);
        expect(config.warnings).toBe(WarningMode.Error);
    });

    it('reads warning mode "error" from env var', async () => {
        vi.stubEnv('LLM_CHAT_SKILL_WARNINGS', 'error');
        const config = new SkillRegistryConfiguration();
        expect(config.warnings).toBe(WarningMode.Error);
    });

    it('reads warning mode "log" from env var', async () => {
        vi.stubEnv('LLM_CHAT_SKILL_WARNINGS', 'log');
        const config = new SkillRegistryConfiguration();
        expect(config.warnings).toBe(WarningMode.Log);
    });

    it('handleWarning logs when mode is log', async () => {
        const config = new SkillRegistryConfiguration(undefined, WarningMode.Log);
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        config.handleWarning('test warning');
        expect(spy).toHaveBeenCalledWith('  [skills] test warning');
        spy.mockRestore();
    });

    it('handleWarning throws when mode is error', async () => {
        const config = new SkillRegistryConfiguration(undefined, WarningMode.Error);
        expect(() => config.handleWarning('boom')).toThrow('boom');
    });

    it('handleWarning is silent when mode is silent', async () => {
        const config = new SkillRegistryConfiguration(undefined, WarningMode.Silent);
        expect(() => config.handleWarning('silent')).not.toThrow();
    });

    // ── Length bounds ───────────────────────────────────────────

    it('reads skill name min from env', () => {
        vi.stubEnv('LLM_CHAT_SKILL_NAME_MIN_LENGTH', '10');
        const config = new SkillRegistryConfiguration();
        expect(config.skillNameMinLength).toBe(10);
    });

    it('reads skill name max from env', () => {
        vi.stubEnv('LLM_CHAT_SKILL_NAME_MIN_LENGTH', '5');
        vi.stubEnv('LLM_CHAT_SKILL_NAME_MAX_LENGTH', '50');
        const config = new SkillRegistryConfiguration();
        expect(config.skillNameMinLength).toBe(5);
        expect(config.skillNameMaxLength).toBe(50);
    });

    it('clamps skill name max to min when env has max < min', () => {
        vi.stubEnv('LLM_CHAT_SKILL_NAME_MIN_LENGTH', '40');
        vi.stubEnv('LLM_CHAT_SKILL_NAME_MAX_LENGTH', '10');
        const config = new SkillRegistryConfiguration();
        expect(config.skillNameMinLength).toBe(40);
        expect(config.skillNameMaxLength).toBe(40);
    });

    it('reads resource content min from env', () => {
        vi.stubEnv('LLM_CHAT_RESOURCE_CONTENT_MIN_LENGTH', '5');
        const config = new SkillRegistryConfiguration();
        expect(config.resourceContentMinLength).toBe(5);
    });

    it('reads resource content max from env', () => {
        vi.stubEnv('LLM_CHAT_RESOURCE_CONTENT_MIN_LENGTH', '1');
        vi.stubEnv('LLM_CHAT_RESOURCE_CONTENT_MAX_LENGTH', '5000');
        const config = new SkillRegistryConfiguration();
        expect(config.resourceContentMinLength).toBe(1);
        expect(config.resourceContentMaxLength).toBe(5000);
    });
});
