# Tools

Tools let the LLM load, inspect, and manage skills. Each tool extends `Tool` from `llm-chat` and delegates to a shared `SkillRegistry` instance.

- **[load_skill](load-skill.md)** — load full instructions for a named skill
- **[get_skill_resource](get-skill-resource.md)** — read a resource file from a skill's references or assets
- **[set_skill](set-skill.md)** — create a new skill or update an existing one
- **[delete_skill](delete-skill.md)** — delete a skill
- **[set_skill_resource](set-skill-resource.md)** — write a resource file into a skill's references or assets
- **[delete_skill_resource](delete-skill-resource.md)** — delete a resource file from a skill's references or assets
