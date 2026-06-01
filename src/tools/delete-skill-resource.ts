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
 * Deletes a resource file from a skill's `references/` or `assets/` directory.
 *
 * Returns descriptive error messages for invalid parameters or filesystem
 * failures.
 */
export class DeleteSkillResourceTool extends Tool {
    private readonly registry: SkillRegistry;

    /**
     * @param registry - The skill registry. Must be initialized before
     *   this tool is used.
     */
    constructor(registry: SkillRegistry) {
        super(
            'delete_skill_resource',
            'Delete a resource from a skill. Use this to remove files that are no longer needed. Load a skill to get its resources.',
            new ToolParameters(
                {
                    skill_name: new ToolParameterProperty(
                        'The name of the skill to delete the resource from.'
                    ),
                    resource_name: new ToolParameterProperty('The name of the resource to delete.')
                },
                ['skill_name', 'resource_name']
            )
        );
        this.registry = registry;
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const skillName = args.skill_name;
        const resourceName = args.resource_name;

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

            await skill.deleteResource(parsed.resource, parsed.fileName);
            return {
                result: `Resource '${resourceName}' deleted from skill '${skillName}'.`,
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
