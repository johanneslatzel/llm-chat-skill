import {
    PartialToolResult,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import { SkillRegistry } from '../lib/registry.js';
import { Skill } from '../lib/skill.js';
import { normaliseName } from '../lib/helper.js';

/**
 * Writes a resource file into a skill's `references/` or `assets/` directory.
 *
 * Returns descriptive error messages for invalid parameters or filesystem
 * failures.
 */
export class SetSkillResourceTool extends Tool {
    private readonly registry: SkillRegistry;

    /**
     * @param registry - The skill registry. Must be initialized before
     *   this tool is used.
     */
    constructor(registry: SkillRegistry) {
        super(
            'set_skill_resource',
            "Write a resource file into a skill's references/ or assets/ directory. Use this to add reference documentation, templates, or other supporting files to a skill.",
            new ToolParameters(
                {
                    skill_name: new ToolParameterProperty(
                        'The name of the skill to write the resource to.'
                    ),
                    resource_name: new ToolParameterProperty(
                        'Resource path within the skill, e.g. "references/REFERENCE.md" or "assets/template.json". Must start with "references/" or "assets/".'
                    ),
                    content: new ToolParameterProperty('File content to write.')
                },
                ['skill_name', 'resource_name', 'content']
            )
        );
        this.registry = registry;
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const skillName = args.skill_name;
        const resourceName = args.resource_name;
        const content = args.content;

        if (typeof skillName !== 'string' || !skillName.trim()) {
            return {
                result: "Required parameter 'skill_name' is missing or not a string",
                status: ResultStatus.Error
            };
        }
        if (typeof resourceName !== 'string' || !resourceName.trim()) {
            return {
                result: "Required parameter 'resource_name' is missing or not a string",
                status: ResultStatus.Error
            };
        }
        if (typeof content !== 'string') {
            return {
                result: "Required parameter 'content' is missing or not a string",
                status: ResultStatus.Error
            };
        }

        try {
            const parsed = Skill.parseResourcePath(resourceName.trim());
            if (!parsed) {
                return {
                    result: `Invalid resource '${resourceName}'. Resource must start with 'references/' or 'assets/'.`,
                    status: ResultStatus.Error
                };
            }

            const skill = this.registry.get(normaliseName(skillName.trim()));
            if (!skill) {
                return { result: `Skill '${skillName}' not found.`, status: ResultStatus.Error };
            }

            this.registry.validateResourceLengths(parsed.fileName, content);
            await skill.setResource(parsed.resource, parsed.fileName, content);
            return {
                result: `Resource '${resourceName}' written to skill '${skillName}'.`,
                status: ResultStatus.Success
            };
        } catch (e) {
            return {
                result: (e as Error).message,
                status: ResultStatus.Error
            };
        }
    }
}
