import {
    PartialToolResult,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import { SkillRegistry } from '../lib/registry.js';

/**
 * Writes a resource into a skill.
 *
 * Returns descriptive error messages for invalid parameters or
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
            'Write a resource into a skill — references, assets, or sections. Use sections to manage the structured body parts of a skill.',
            new ToolParameters(
                {
                    skill_name: new ToolParameterProperty(
                        'The name of the skill to write the resource to.'
                    ),
                    resourceType: new ToolParameterProperty(
                        'Resource type — must be references, assets, or sections.'
                    ),
                    name: new ToolParameterProperty(
                        'Resource identifier (e.g. "guide" for references/assets). For sections, must be one of: purpose.md, inputs-outputs.md, constraints.md, workflow.md, decision-criteria.md, examples.md, anti-patterns.md.'
                    ),
                    content: new ToolParameterProperty('Content to write.')
                },
                ['skill_name', 'resourceType', 'name', 'content']
            )
        );
        this.registry = registry;
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const skillName = args.skill_name;
        const resourceType = args.resourceType;
        const name = args.name;
        const content = args.content;

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
        if (typeof content !== 'string') {
            return {
                result: "Required parameter 'content' is missing or not a string",
                status: ResultStatus.Error
            };
        }

        try {
            const skill = this.registry.get(skillName);
            if (!skill) {
                return { result: `Skill '${skillName}' not found.`, status: ResultStatus.Error };
            }

            this.registry.validateResourceLengths(name.trim(), content);
            await skill.setResource(resourceType.trim(), name.trim(), content);
            return {
                result: `Resource '${name}' of type '${resourceType}' written to skill '${skillName}'.`,
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
