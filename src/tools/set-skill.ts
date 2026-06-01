import {
    PartialToolResult,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import { SkillRegistry } from '../lib/registry.js';
import { normaliseName } from '../lib/helper.js';

/**
 * Creates or updates a skill in the skill directory.
 *
 * If the skill does not exist it is created; if it already exists its
 * properties are updated. When renaming (`new_name`), the skill folder
 * on disk is also renamed to match the new name.
 *
 * Returns descriptive error messages for invalid parameters or
 * filesystem failures.
 */
export class SetSkillTool extends Tool {
    private readonly registry: SkillRegistry;

    /**
     * @param registry - The skill registry. Must be initialized before
     *   this tool is used.
     */
    constructor(registry: SkillRegistry) {
        super(
            'set_skill',
            'Create a new skill or update an existing one. Provide a name and description to create a new skill, or use the name of an existing skill to update its properties (description, body) or rename it (new_name). The skill folder on disk is renamed when new_name is provided.',
            new ToolParameters(
                {
                    name: new ToolParameterProperty(
                        'The skill name. If the skill does not exist it is created; if it exists it is updated.'
                    ),
                    description: new ToolParameterProperty(
                        'Short description. Required when creating a new skill, optional when updating.'
                    ),
                    body: new ToolParameterProperty(
                        'Full instruction body (the markdown content after frontmatter). Optional.'
                    ),
                    new_name: new ToolParameterProperty(
                        'New name for the skill (update only). When provided, the skill folder is renamed to match.'
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

        const sanitizedName = normaliseName(name.trim());

        try {
            const existing = this.registry.get(sanitizedName);
            if (existing) {
                return await this.handleUpdate(sanitizedName, args);
            }
            return await this.handleCreate(sanitizedName, args);
        } catch (e) {
            return {
                result: (e as Error).message,
                status: ResultStatus.Error
            };
        }
    }

    private async handleCreate(
        name: string,
        args: Record<string, unknown>
    ): Promise<PartialToolResult> {
        const description = args.description;
        if (typeof description !== 'string' || !description.trim()) {
            return {
                result: "Required parameter 'description' is missing or not a string for creating a new skill",
                status: ResultStatus.Error
            };
        }
        const body = args.body;
        if (typeof body !== 'string') {
            return {
                result: "Required parameter 'body' is missing or not a string for creating a new skill",
                status: ResultStatus.Error
            };
        }

        const skill = await this.registry.createSkill(name, description.trim(), body);
        return {
            result: `Skill '${skill.name}' created successfully.`,
            status: ResultStatus.Success
        };
    }

    private async handleUpdate(
        name: string,
        args: Record<string, unknown>
    ): Promise<PartialToolResult> {
        const new_name =
            typeof args.new_name === 'string' ? normaliseName(args.new_name.trim()) : undefined;
        const description =
            typeof args.description === 'string' ? args.description.trim() : undefined;
        const body = typeof args.body === 'string' ? args.body : undefined;

        if (!new_name && !description && body === undefined) {
            return {
                result: "At least one of 'description', 'body', or 'new_name' must be provided",
                status: ResultStatus.Error
            };
        }

        const updates: { new_name?: string; description?: string; body?: string } = {};
        if (new_name) updates.new_name = new_name;
        if (description) updates.description = description;
        if (body !== undefined) updates.body = body;

        const skill = await this.registry.updateSkill(name, updates);

        const parts: string[] = [];
        if (new_name) parts.push(`name → '${skill.name}'`);
        if (description) parts.push(`description → '${skill.description}'`);
        if (body !== undefined) parts.push('body updated');
        return {
            result: `Skill '${new_name ? name : skill.name}' updated: ${parts.join(', ')}.`,
            status: ResultStatus.Success
        };
    }
}
