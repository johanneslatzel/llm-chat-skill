# Registry

The `SkillRegistry` discovers, parses, and serves skills from a configured directory. Skills are stored in `SKILL.md` files with YAML frontmatter.

- **[Configuration](configuration.md)** — `SkillRegistryConfiguration` reference
- **[Skill file format](skill-format.md)** — anatomy of a `SKILL.md` file

## Listing skills

`registry.listing()` returns a human-readable string of all loaded skills, suitable for inclusion in a system prompt so the LLM knows what tools are available:

```ts
import { SkillRegistry, SkillRegistryConfiguration } from '@johannes.latzel/llm-chat-skill';

const config = new SkillRegistryConfiguration('./skills');
const registry = new SkillRegistry(config);
await registry.initialize();

const systemMessage = `You have access to the following skills:\n\n${registry.listing()}`;
```

Example output:

```
Available skills:
  - my_tool: A demonstration skill
  - notebook: Jupyter notebook operations
Use the load_skill tool to load the full instructions for any skill.
Use the get_skill_resource tool to read resource files from a skill.
Use the set_skill_resource tool to write resource files to a skill.
Use the delete_skill_resource tool to delete resource files from a skill.
```
