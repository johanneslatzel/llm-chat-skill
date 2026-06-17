# Tools

Tools let the LLM load, inspect, and manage skills. Each tool extends `Tool` from `llm-chat` and delegates to a shared `SkillRegistry` instance.

- **[load_skill](load-skill.md)** — load full instructions for a named skill (body auto-composed for structured skills)
- **[get_skill_resource](get-skill-resource.md)** — read a resource file from a skill's references, assets, or sections
- **[set_skill](set-skill.md)** — create a new skill or update an existing one (omit body for structured shell)
- **[delete_skill](delete-skill.md)** — delete a skill
- **[set_skill_resource](set-skill-resource.md)** — write a resource file into a skill's references, assets, or sections
- **[delete_skill_resource](delete-skill-resource.md)** — delete a resource file from a skill's references, assets, or sections
- **[search_resources](search-resources.md)** — search resource file contents across skills using a regex pattern
- **[list_resources](list-resources.md)** — list resource files across all skills, optionally filtered by type
