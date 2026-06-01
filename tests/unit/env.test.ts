import { describe, it, expect, vi, afterEach } from 'vitest';
import { envInt, envString } from '../../src/env.js';

describe('envInt', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('returns fallback when env var is not set', () => {
        const result = envInt('UNSET_VAR', 42, 1);
        expect(result).toBe(42);
    });

    it('returns fallback when env var is empty', () => {
        vi.stubEnv('EMPTY_VAR', '');
        const result = envInt('EMPTY_VAR', 42, 1);
        expect(result).toBe(42);
    });

    it('returns parsed value when env var is a valid integer', () => {
        vi.stubEnv('MY_VAR', '50');
        const result = envInt('MY_VAR', 42, 1);
        expect(result).toBe(50);
    });

    it('returns fallback when env var is not a number', () => {
        vi.stubEnv('BAD_VAR', 'not-a-number');
        const result = envInt('BAD_VAR', 10, 1);
        expect(result).toBe(10);
    });

    it('clamps parsed value to min', () => {
        vi.stubEnv('LOW_VAR', '1');
        const result = envInt('LOW_VAR', 10, 5);
        expect(result).toBe(5);
    });

    it('clamps fallback to min', () => {
        const result = envInt('UNSET_VAR', 1, 10);
        expect(result).toBe(10);
    });

    it('clamps parsed value to max', () => {
        vi.stubEnv('HIGH_VAR', '100');
        const result = envInt('HIGH_VAR', 50, 1, 80);
        expect(result).toBe(80);
    });

    it('clamps fallback to max', () => {
        vi.stubEnv('HIGH_VAR', '');
        const result = envInt('HIGH_VAR', 200, 1, 100);
        expect(result).toBe(100);
    });

    it('parsed value within min-max range passes through', () => {
        vi.stubEnv('OK_VAR', '50');
        const result = envInt('OK_VAR', 42, 10, 100);
        expect(result).toBe(50);
    });
});

describe('envString', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('returns fallback when env var is not set', () => {
        const result = envString('UNSET', 'default');
        expect(result).toBe('default');
    });

    it('returns env value when set', () => {
        vi.stubEnv('MY_STR', 'hello');
        const result = envString('MY_STR', 'default');
        expect(result).toBe('hello');
    });

    it('returns env value when set to empty string', () => {
        vi.stubEnv('MY_STR', '');
        const result = envString('MY_STR', 'default');
        expect(result).toBe('');
    });
});
