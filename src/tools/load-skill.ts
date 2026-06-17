import {
    PartialToolResult,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import { SkillRegistry } from '../lib/registry.js';

/**
 * Loads the full instructions for a named skill, including a listing of
 * its available resources (references, assets, and sections).
 *
 * Returns an error message when the skill is not found.
 */
export class LoadSkillTool extends Tool {
    private readonly registry: SkillRegistry;

    /**
     * @param registry - The skill registry to query. Must be initialized
     *   before this tool is used.
     */
    constructor(registry: SkillRegistry) {
        super(
            'load_skill',
            'Load the full instructions for a named skill, together with a listing of its available resource. Use this when you need detailed guidance on how to use a particular skill.',
            new ToolParameters(
                {
                    name: new ToolParameterProperty(
                        'The name of the skill to load (e.g., "notebook", "websearch")'
                    )
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
        const skill = this.registry.get(name);
        if (!skill) {
            return {
                result: `Skill '${name}' not found.\n\n${await this.registry.listing()}`,
                status: ResultStatus.Error
            };
        }

        const resources = await skill.listResources();
        let result = skill.body;
        if (resources.length > 0) {
            result += '\n\n--- Resources ---\n';
            for (const r of resources) {
                result += `\n${r.resource}/${r.fileName}`;
            }
        }

        return {
            result,
            status: ResultStatus.Success
        };
    }
}
