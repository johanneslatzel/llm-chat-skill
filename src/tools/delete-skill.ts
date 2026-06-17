import {
    PartialToolResult,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import { SkillRegistry } from '../lib/registry.js';

/**
 * Deletes a skill.
 *
 * Returns descriptive error messages for invalid parameters or
 * failures.
 */
export class DeleteSkillTool extends Tool {
    private readonly registry: SkillRegistry;

    /**
     * @param registry - The skill registry. Must be initialized before
     *   this tool is used.
     */
    constructor(registry: SkillRegistry) {
        super(
            'delete_skill',
            'Delete a skill.',
            new ToolParameters(
                {
                    name: new ToolParameterProperty('The name of the skill to delete.')
                },
                ['name']
            )
        );
        this.registry = registry;
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const name = args.name;

        if (typeof name !== 'string' || !name.trim()) {
            return {
                result: "Required parameter 'name' is missing or not a string",
                status: ResultStatus.Error
            };
        }

        try {
            await this.registry.deleteSkill(name);
            return {
                result: `Skill '${name}' deleted successfully.`,
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
