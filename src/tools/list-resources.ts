import {
    PartialToolResult,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import { SkillRegistry } from '../lib/registry.js';

/**
 * Lists resource files across all skills (or within a specific skill),
 * optionally filtered by resource type.
 */
export class ListResourcesTool extends Tool {
    private readonly registry: SkillRegistry;

    /**
     * @param registry - The skill registry to query. Must be initialized
     *   before this tool is used.
     */
    constructor(registry: SkillRegistry) {
        super(
            'list_resources',
            'List resource files across all skills, optionally filtered by skill name or resource type (references, assets, sections).',
            new ToolParameters(
                {
                    skill_name: new ToolParameterProperty(
                        'Optional — only list resources for a specific skill.'
                    ),
                    resource_type: new ToolParameterProperty(
                        'Optional — only list resources of this type (references, assets, or sections).'
                    )
                },
                []
            )
        );
        this.registry = registry;
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const skillFilter = args.skill_name;
        if (skillFilter !== undefined && (typeof skillFilter !== 'string' || !skillFilter.trim())) {
            return {
                result: "Parameter 'skill_name' must be a non-empty string if provided",
                status: ResultStatus.Error
            };
        }

        const typeFilter = args.resource_type;
        if (typeFilter !== undefined && (typeof typeFilter !== 'string' || !typeFilter.trim())) {
            return {
                result: "Parameter 'resource_type' must be a non-empty string if provided",
                status: ResultStatus.Error
            };
        }

        const validTypes = ['references', 'assets', 'sections'];
        if (typeFilter !== undefined && !validTypes.includes(typeFilter)) {
            return {
                result: `Invalid resource_type '${typeFilter}'. Must be one of: ${validTypes.join(', ')}`,
                status: ResultStatus.Error
            };
        }

        let skills = this.registry.list();
        if (skillFilter) {
            const skill = this.registry.get(skillFilter);
            if (!skill) {
                return {
                    result: `Skill '${skillFilter}' not found.`,
                    status: ResultStatus.Error
                };
            }
            skills = [skill];
        }

        const skillEntries: { name: string; resources: { type: string; files: string[] }[] }[] = [];
        let totalResources = 0;

        for (const skill of skills) {
            const allResources = await skill.listResources();
            let filtered = allResources;
            if (typeFilter) {
                filtered = allResources.filter((r) => r.resource === typeFilter);
            }

            if (filtered.length === 0) continue;

            const grouped = new Map<string, string[]>();
            for (const r of filtered) {
                const list = grouped.get(r.resource) ?? [];
                list.push(r.fileName);
                grouped.set(r.resource, list);
            }

            const groups: { type: string; files: string[] }[] = [];
            for (const [resType, files] of grouped) {
                groups.push({ type: resType, files });
            }
            groups.sort((a, b) => a.type.localeCompare(b.type));

            skillEntries.push({ name: skill.name, resources: groups });
            totalResources += filtered.length;
        }

        if (totalResources === 0) {
            const scope = skillFilter ? ` for skill '${skillFilter}'` : ' across any skill';
            return {
                result: `No resources found${scope}.`,
                status: ResultStatus.Success
            };
        }

        const lines: string[] = [];
        const skillCount = skillEntries.length;
        lines.push(
            skillFilter
                ? `Resources for ${skillFilter}:`
                : `Resources across ${skillCount} skill${skillCount === 1 ? '' : 's'}:`
        );

        for (const entry of skillEntries) {
            lines.push(`\n${entry.name}:`);
            for (const group of entry.resources) {
                lines.push(`    - ${group.type}:`);
                for (const file of group.files) {
                    lines.push(`        - ${file}`);
                }
            }
        }

        lines.push(`\nTotal: ${totalResources} resource${totalResources === 1 ? '' : 's'}.`);
        return {
            result: lines.join('\n'),
            status: ResultStatus.Success
        };
    }
}
