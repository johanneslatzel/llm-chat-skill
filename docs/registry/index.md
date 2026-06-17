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

## Auto-wiring into the system prompt

When using `@johannes.latzel/llm-chat`, pass your `ChatService` instance to `initialize()` to automatically inject the listing into the system prompt under a `skills` heading:

```ts
import { SkillRegistry, SkillToolPackage } from '@johannes.latzel/llm-chat-skill';

const registry = new SkillRegistry(config);
await registry.initialize(service);

service.tools().add(new SkillToolPackage(registry));
```

The registry adds a `skills` prompt to the root system prompt container, rendered as:

```
skills
    Available skills:
        - my_tool:
            - description: A demonstration skill
            - body-format: structured
            - tags: automation, demo
            - assets: 2
            - references: 1
        - notebook:
            - description: Jupyter notebook operations
            - body-format: plain
            - assets: 0
            - references: 0
```

The listing stays in sync automatically — `createSkill`, `updateSkill`, and `deleteSkill` each refresh the prompt via `setContent()`, which invalidates the system prompt cache so the change takes effect on the next `send()`.

If you omit the `service` parameter, `initialize()` works exactly as before with no prompt wiring.
