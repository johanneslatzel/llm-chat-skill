# Tool Package

The `SkillToolPackage` bundles all eight tools into a single `ToolPackage` for registration with a `ChatService`:

```ts
import { SkillRegistry, SkillToolPackage } from '@johannes.latzel/llm-chat-skill';

const registry = new SkillRegistry();
await registry.initialize();

service.tools().add(new SkillToolPackage(registry));
// All 8 tools are now registered
```

The package also provides a tutorial via `tutorial()` with a skill-system usage guide. When the suite is wired to a `ChatService`, the tutorial populates the `tutorials` container in the system prompt automatically.

When used with a `ChatService`, pass the service to `registry.initialize(service)` to wire the skill listing into the system prompt. See [Auto-wiring into the system prompt](registry/index.md) for details.


## See also

- [Tools](../tools/index.md): the eight skill tools
- [Registry](../registry/index.md): `SkillRegistry` and configuration
- [Quick start](../examples/quick-start.md): create and load the first skill
