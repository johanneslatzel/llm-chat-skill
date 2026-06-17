import {
    PartialToolResult,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import { SkillRegistry } from '../lib/registry.js';

/**
 * Reads a resource from a skill.
 *
 * Returns descriptive error messages for unknown skills or invalid
 * resource specifications.
 */
export class GetSkillResourceTool extends Tool {
    private readonly registry: SkillRegistry;

    /**
     * @param registry - The skill registry to query. Must be initialized
     *   before this tool is used.
     */
    constructor(registry: SkillRegistry) {
        super(
            'get_skill_resource',
            'Get additional resources provided by a skill — references, assets, or sections. Use this when you need documentation, templates, or structured body parts of a skill.',
            new ToolParameters(
                {
                    skill_name: new ToolParameterProperty(
                        'The name of the skill to read from (e.g., "notebook")'
                    ),
                    resourceType: new ToolParameterProperty(
                        'Resource type — must be references, assets, or sections.'
                    ),
                    name: new ToolParameterProperty(
                        'Resource identifier, e.g. "guide" or "purpose".'
                    )
                },
                ['skill_name', 'resourceType', 'name']
            )
        );
        this.registry = registry;
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const skillName = args.skill_name;
        const resourceType = args.resourceType;
        const name = args.name;

        if (typeof skillName !== 'string' || !skillName.trim()) {
            return {
                result: "Required parameter 'skill_name' is missing or not a string",
                status: ResultStatus.Error
            };
        }
        if (typeof resourceType !== 'string' || !resourceType.trim()) {
            return {
                result: "Required parameter 'resourceType' is missing or not a string",
                status: ResultStatus.Error
            };
        }
        if (typeof name !== 'string' || !name.trim()) {
            return {
                result: "Required parameter 'name' is missing or not a string",
                status: ResultStatus.Error
            };
        }

        const skill = this.registry.get(skillName);
        if (!skill) {
            return { result: `Skill '${skillName}' not found.`, status: ResultStatus.Error };
        }
        const content = await skill.getResource(resourceType.trim(), name.trim());
        if (content !== null) {
            return { result: content, status: ResultStatus.Success };
        }

        return {
            result: `Resource '${name}' of type '${resourceType}' not found in skill '${skillName}'.`,
            status: ResultStatus.Error
        };
    }
}
