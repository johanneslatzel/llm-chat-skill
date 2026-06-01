import { envInt } from '../env.js';

/** How warnings during skill loading are handled. */
export enum WarningMode {
    /** Throws an `Error` on warning. */
    Error = 'error',
    /** Writes to `console.warn`. */
    Log = 'log',
    /** Suppressed entirely. */
    Silent = 'silent'
}

// ── Default bounds for skill and resource fields ────────────────────

/** Default minimum length for a skill name. */
export const DEFAULT_SKILL_NAME_MIN_LENGTH = 5;
/** Default maximum length for a skill name. */
export const DEFAULT_SKILL_NAME_MAX_LENGTH = 60;
/** Default minimum length for a skill description. */
export const DEFAULT_SKILL_DESCRIPTION_MIN_LENGTH = 25;
/** Default maximum length for a skill description. */
export const DEFAULT_SKILL_DESCRIPTION_MAX_LENGTH = 500;
/** Default minimum length for a skill body (instructions). */
export const DEFAULT_SKILL_BODY_MIN_LENGTH = 300;
/** Default maximum length for a skill body (instructions). */
export const DEFAULT_SKILL_BODY_MAX_LENGTH = 20_000;
/** Default minimum length for a resource file name. */
export const DEFAULT_RESOURCE_NAME_MIN_LENGTH = 5;
/** Default maximum length for a resource file name. */
export const DEFAULT_RESOURCE_NAME_MAX_LENGTH = 60;
/** Default minimum length for resource file content. */
export const DEFAULT_RESOURCE_CONTENT_MIN_LENGTH = 1;
/** Default maximum length for resource file content. */
export const DEFAULT_RESOURCE_CONTENT_MAX_LENGTH = 10_000;

/**
 * Configuration for {@link SkillRegistry}.
 *
 * Controls the skill directory path, warning behavior, and length bounds
 * for skill and resource fields. Each bound can be set via environment
 * variable, overridden on the instance after construction, or left at its
 * default constant.
 */
export class SkillRegistryConfiguration {
    /** Path to the directory containing skill subdirectories. */
    skillDir: string = process.env.LLM_CHAT_SKILL_DIR ?? '';

    /** How warnings during skill loading are handled. */
    warnings: WarningMode;

    // ── Length bounds ───────────────────────────────────────────────

    /**
     * Minimum length for a skill name.
     * Env: `LLM_CHAT_SKILL_NAME_MIN_LENGTH` (default: {@link DEFAULT_SKILL_NAME_MIN_LENGTH}).
     */
    skillNameMinLength: number;

    /**
     * Maximum length for a skill name.
     * Env: `LLM_CHAT_SKILL_NAME_MAX_LENGTH` (default: {@link DEFAULT_SKILL_NAME_MAX_LENGTH}).
     */
    skillNameMaxLength: number;

    /**
     * Minimum length for a skill description.
     * Env: `LLM_CHAT_SKILL_DESCRIPTION_MIN_LENGTH` (default: {@link DEFAULT_SKILL_DESCRIPTION_MIN_LENGTH}).
     */
    skillDescriptionMinLength: number;

    /**
     * Maximum length for a skill description.
     * Env: `LLM_CHAT_SKILL_DESCRIPTION_MAX_LENGTH` (default: {@link DEFAULT_SKILL_DESCRIPTION_MAX_LENGTH}).
     */
    skillDescriptionMaxLength: number;

    /**
     * Minimum length for a skill body (instructions).
     * Env: `LLM_CHAT_SKILL_BODY_MIN_LENGTH` (default: {@link DEFAULT_SKILL_BODY_MIN_LENGTH}).
     */
    skillBodyMinLength: number;

    /**
     * Maximum length for a skill body (instructions).
     * Env: `LLM_CHAT_SKILL_BODY_MAX_LENGTH` (default: {@link DEFAULT_SKILL_BODY_MAX_LENGTH}).
     */
    skillBodyMaxLength: number;

    /**
     * Minimum length for a resource file name (excluding the `references/` or `assets/` prefix).
     * Env: `LLM_CHAT_RESOURCE_NAME_MIN_LENGTH` (default: {@link DEFAULT_RESOURCE_NAME_MIN_LENGTH}).
     */
    resourceNameMinLength: number;

    /**
     * Maximum length for a resource file name.
     * Env: `LLM_CHAT_RESOURCE_NAME_MAX_LENGTH` (default: {@link DEFAULT_RESOURCE_NAME_MAX_LENGTH}).
     */
    resourceNameMaxLength: number;

    /**
     * Minimum length for resource file content.
     * Env: `LLM_CHAT_RESOURCE_CONTENT_MIN_LENGTH` (default: {@link DEFAULT_RESOURCE_CONTENT_MIN_LENGTH}).
     */
    resourceContentMinLength: number;

    /**
     * Maximum length for resource file content.
     * Env: `LLM_CHAT_RESOURCE_CONTENT_MAX_LENGTH` (default: {@link DEFAULT_RESOURCE_CONTENT_MAX_LENGTH}).
     */
    resourceContentMaxLength: number;

    /**
     * @param skillDir - Override for the skill directory path.
     * @param warnings - Override for the warning mode.
     */
    constructor(skillDir?: string, warnings?: WarningMode) {
        if (skillDir !== undefined) this.skillDir = skillDir;

        const envWarnings = process.env.LLM_CHAT_SKILL_WARNINGS;
        if (warnings !== undefined) {
            this.warnings = warnings;
        } else if (envWarnings === 'error') {
            this.warnings = WarningMode.Error;
        } else if (envWarnings === 'log') {
            this.warnings = WarningMode.Log;
        } else {
            this.warnings = WarningMode.Silent;
        }

        // ── Read bounds from env (min first, then max chained) ──────

        const skillNameMin = envInt(
            'LLM_CHAT_SKILL_NAME_MIN_LENGTH',
            DEFAULT_SKILL_NAME_MIN_LENGTH,
            1
        );
        this.skillNameMinLength = skillNameMin;
        this.skillNameMaxLength = envInt(
            'LLM_CHAT_SKILL_NAME_MAX_LENGTH',
            DEFAULT_SKILL_NAME_MAX_LENGTH,
            skillNameMin
        );

        const skillDescMin = envInt(
            'LLM_CHAT_SKILL_DESCRIPTION_MIN_LENGTH',
            DEFAULT_SKILL_DESCRIPTION_MIN_LENGTH,
            1
        );
        this.skillDescriptionMinLength = skillDescMin;
        this.skillDescriptionMaxLength = envInt(
            'LLM_CHAT_SKILL_DESCRIPTION_MAX_LENGTH',
            DEFAULT_SKILL_DESCRIPTION_MAX_LENGTH,
            skillDescMin
        );

        const skillBodyMin = envInt(
            'LLM_CHAT_SKILL_BODY_MIN_LENGTH',
            DEFAULT_SKILL_BODY_MIN_LENGTH,
            0
        );
        this.skillBodyMinLength = skillBodyMin;
        this.skillBodyMaxLength = envInt(
            'LLM_CHAT_SKILL_BODY_MAX_LENGTH',
            DEFAULT_SKILL_BODY_MAX_LENGTH,
            skillBodyMin
        );

        const resourceNameMin = envInt(
            'LLM_CHAT_RESOURCE_NAME_MIN_LENGTH',
            DEFAULT_RESOURCE_NAME_MIN_LENGTH,
            1
        );
        this.resourceNameMinLength = resourceNameMin;
        this.resourceNameMaxLength = envInt(
            'LLM_CHAT_RESOURCE_NAME_MAX_LENGTH',
            DEFAULT_RESOURCE_NAME_MAX_LENGTH,
            resourceNameMin
        );

        const resourceContentMin = envInt(
            'LLM_CHAT_RESOURCE_CONTENT_MIN_LENGTH',
            DEFAULT_RESOURCE_CONTENT_MIN_LENGTH,
            0
        );
        this.resourceContentMinLength = resourceContentMin;
        this.resourceContentMaxLength = envInt(
            'LLM_CHAT_RESOURCE_CONTENT_MAX_LENGTH',
            DEFAULT_RESOURCE_CONTENT_MAX_LENGTH,
            resourceContentMin
        );
    }

    /**
     * Processes a warning message according to the configured `warnings` mode.
     *
     * @param message - The warning text.
     * @throws {Error} When `warnings` is `WarningMode.Error`.
     */
    handleWarning(message: string): void {
        if (this.warnings === WarningMode.Error) throw new Error(message);
        if (this.warnings === WarningMode.Log) console.warn(`  [skills] ${message}`);
    }
}
