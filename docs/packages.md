# Tool Package

The `SkillToolPackage` bundles all six tools into a single `ToolPackage` for convenient registration with `ToolSuite`:

```ts
import { ToolSuite } from '@johannes.latzel/llm-chat';
import { SkillRegistry, SkillToolPackage } from '@johannes.latzel/llm-chat-skill';

const registry = new SkillRegistry();
await registry.initialize();

const suite = new ToolSuite();
suite.add(new SkillToolPackage(registry));

// All 6 tools are now registered
const openAiTools = suite.getTools();
```

The package also provides a tutorial via `tutorial()` with a skill-system usage guide, surfaced when `ToolSuite.composeTutorials()` is called.

When used with a `ChatService`, pass the service to `registry.initialize(service)` to automatically inject a `skills` prompt with the current skill listing into the system prompt. The listing refreshes on every create/update/delete.
