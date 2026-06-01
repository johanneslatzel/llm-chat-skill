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
 * Reads a resource file from a skill's `references/` or `assets/` directory.
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
            "Get additional resources provided by a skill. Use this when you need additional documentation or templates referenced by a skill. Provide the skill name and the resource type (references or assets) together with the file name, e.g. 'references/guide.md'.",
            new ToolParameters(
                {
                    skill_name: new ToolParameterProperty(
                        'The name of the skill to read from (e.g., "notebook")'
                    ),
                    resource_name: new ToolParameterProperty(
                        'Resource type and file name, e.g. "references/REFERENCE.md" or "assets/template.json"'
                    )
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

        const parsed = Skill.parseResourcePath(resourceName.trim());
        if (!parsed) {
            return {
                result: "Invalid resource specification. Use 'references/<name>' or 'assets/<name>' (e.g. 'references/guide.md').",
                status: ResultStatus.Error
            };
        }

        const s = this.registry.get(normaliseName(skillName.trim()));
        if (!s) {
            return { result: `Skill '${skillName}' not found.`, status: ResultStatus.Error };
        }

        const content = await s.getResource(parsed.resource, parsed.fileName);
        if (content !== null) {
            return { result: content, status: ResultStatus.Success };
        }

        return {
            result: `Resource '${parsed.resource}/${parsed.fileName}' not found in skill '${skillName}'.`,
            status: ResultStatus.Error
        };
    }
}
