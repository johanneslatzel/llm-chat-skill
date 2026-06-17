import {
    PartialToolResult,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import { SkillRegistry } from '../lib/registry.js';

/**
 * Searches resource file contents across skills using a regex query.
 *
 * Matching lines are returned with line numbers. Search is
 * case-insensitive by default.
 */
export class SearchResourcesTool extends Tool {
    private readonly registry: SkillRegistry;

    /**
     * @param registry - The skill registry to query. Must be initialized
     *   before this tool is used.
     */
    constructor(registry: SkillRegistry) {
        super(
            'search_resources',
            'Search resource file contents across skills using a regular expression. Returns matching lines with line numbers. The pattern is matched case-insensitively.',
            new ToolParameters(
                {
                    query: new ToolParameterProperty(
                        'Regex pattern to search for (case-insensitive). Examples: "deploy", "TODO|FIXME", "\\berror\\b"'
                    ),
                    skill_name: new ToolParameterProperty(
                        'Optional — restrict search to a specific skill.'
                    ),
                    resource_type: new ToolParameterProperty(
                        'Optional — restrict search to resources of this type (references, assets, or sections).'
                    )
                },
                ['query']
            )
        );
        this.registry = registry;
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const query = args.query;
        if (typeof query !== 'string' || !query.trim()) {
            return {
                result: "Required parameter 'query' is missing or not a string",
                status: ResultStatus.Error
            };
        }

        let regex: RegExp;
        try {
            regex = new RegExp(query, 'i');
        } catch (e) {
            return {
                result: `Invalid regex pattern: ${(e as Error).message}`,
                status: ResultStatus.Error
            };
        }

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

        const lines: string[] = [];
        let totalMatches = 0;

        for (const skill of skills) {
            const resources = await skill.listResources();
            let filtered = resources;
            if (typeFilter) {
                filtered = resources.filter((r) => r.resource === typeFilter);
            }

            for (const res of filtered) {
                const content = await skill.getResource(res.resource, res.fileName);
                if (content === null) continue;

                const contentLines = content.split('\n');
                const matches: { line: number; text: string }[] = [];
                for (let i = 0; i < contentLines.length; i++) {
                    if (regex.test(contentLines[i]!)) {
                        matches.push({ line: i + 1, text: contentLines[i]! });
                    }
                }

                if (matches.length > 0) {
                    lines.push(`\n${skill.name} (${res.resource}/${res.fileName}):`);
                    for (const m of matches) {
                        lines.push(`  line ${m.line}: ${m.text}`);
                    }
                    totalMatches += matches.length;
                }
            }
        }

        if (totalMatches === 0) {
            return {
                result: `No matches found for '${query}'.`,
                status: ResultStatus.Success
            };
        }

        lines.push(
            `\n${totalMatches} match${totalMatches === 1 ? '' : 'es'} across ${skillFilter ? '1 skill' : `${skills.length} skills`}.`
        );
        return {
            result: lines.join('\n'),
            status: ResultStatus.Success
        };
    }
}
