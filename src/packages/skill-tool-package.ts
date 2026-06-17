import { ToolPackage } from '@johannes.latzel/llm-chat';
import { SkillRegistry } from '../lib/registry.js';
import { LoadSkillTool } from '../tools/load-skill.js';
import { SetSkillTool } from '../tools/set-skill.js';
import { DeleteSkillTool } from '../tools/delete-skill.js';
import { GetSkillResourceTool } from '../tools/get-skill-resource.js';
import { SetSkillResourceTool } from '../tools/set-skill-resource.js';
import { DeleteSkillResourceTool } from '../tools/delete-skill-resource.js';
import { SearchResourcesTool } from '../tools/search-resources.js';
import { ListResourcesTool } from '../tools/list-resources.js';

const SKILL_GUIDE = `Skill System Usage Guide
=========================

Two skill types:

  Plain skill       Created WITH a body via set_skill. Body is a single
                    markdown string.

  Structured skill  Created WITHOUT a body (name + description only).
                    Body is auto-composed from individual sections
                    managed via the resource tools.

Writing or deleting a section triggers body recomposition. Each section is
wrapped under an auto-generated level-1 heading (e.g. "# Workflow").
Headings inside section content are demoted one level; ###### stays as-is.

Dos and Don'ts for section content:

  ✓ DO write content that expands on the section — the auto-generated
    heading already introduces the topic. Use # for a major sub-heading
    (becomes ## in the final body), ## for sub-sub-headings, etc.

    workflow.md content:          Final output:
      # Step 1                      # Workflow
      Assess confidence...          ## Step 1
                                    Assess confidence...

  ✗ DON'T restate the section heading in your file — it creates
    redundant text in the output:

    workflow.md content:          Final output:
      # Workflow                    # Workflow      <- auto-generated
                                    ## Workflow     <- from file, redundant

Creating
--------

set_skill with name + description + body → plain skill.
set_skill with name + description only   → structured shell.

Managing sections (structured only)
-----------------------------------

  Only the following predefined section names are accepted:
    purpose.md, inputs-outputs.md, constraints.md,
    workflow.md, decision-criteria.md, examples.md,
    anti-patterns.md

  set_skill_resource(skill_name, "sections", "purpose.md", content)
  get_skill_resource(skill_name, "sections", "workflow.md")
  delete_skill_resource(skill_name, "sections", "purpose.md")

Managing references & assets
----------------------------

  Same tools with "references" or "assets" as the resource type.

Loading, updating, deleting
---------------------------

  load_skill(name) — returns body + resource listing.
  set_skill(name, description?, new_name?) — body not allowed for
    structured skills (update sections via set_skill_resource instead).
  delete_skill(name).

Discovering
-----------

  search_resources(query, skill_name?, resource_type?) — search
    resource file contents across skills using a regex pattern.
  list_resources(skill_name?, resource_type?) — list resource
    files across all skills, optionally filtered by type.

Constraints
-----------

  • Resource type must be sections, references, or assets.
  • Section name must be one of the 7 predefined names (purpose.md, inputs-outputs.md, constraints.md, workflow.md, decision-criteria.md, examples.md, anti-patterns.md).
  • Resource name: 5-60 chars, content: 1-10,000 chars.
  • set_skill with body on a structured skill → error.
  • sections resource on a plain skill → error.
  • search_resources: invalid regex patterns return an error.
`;

/**
 * A {@link ToolPackage} that bundles all skill-management tools.
 *
 * Use with `ToolSuite.add(new SkillToolPackage(registry))` to register
 * all tools at once.
 *
 * The package also provides a built-in tutorial that explains how to
 * use the skill system (the "skill-guide" content).
 */
export class SkillToolPackage extends ToolPackage {
    constructor(registry: SkillRegistry) {
        super([
            new LoadSkillTool(registry),
            new SetSkillTool(registry),
            new DeleteSkillTool(registry),
            new GetSkillResourceTool(registry),
            new SetSkillResourceTool(registry),
            new DeleteSkillResourceTool(registry),
            new SearchResourcesTool(registry),
            new ListResourcesTool(registry)
        ]);
    }

    /** Returns the skill-guide content as a tutorial. */
    tutorial(): string | null {
        return SKILL_GUIDE;
    }
}

export { SKILL_GUIDE };
