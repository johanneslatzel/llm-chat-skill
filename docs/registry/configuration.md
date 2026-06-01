# Configuration

## SkillRegistryConfiguration

Controls the skill directory path and warning behavior.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `skillDir` | `string` | `LLM_CHAT_SKILL_DIR` or `""` | Path to the directory containing skill files |
| `warnings` | `WarningMode` | `LLM_CHAT_SKILL_WARNINGS` or `WarningMode.Silent` | How warnings during loading are handled |

### Constructor

```ts
new SkillRegistryConfiguration(skillDir?: string, warnings?: WarningMode)
```

### WarningMode enum

| Member | Value | Behavior |
|--------|-------|----------|
| `WarningMode.Silent` | `'silent'` | Suppresses all warnings (default) |
| `WarningMode.Log` | `'log'` | Writes to `console.warn` |
| `WarningMode.Error` | `'error'` | Throws an `Error` on warning |

### Example

```ts
import { SkillRegistryConfiguration, WarningMode } from '@johannes.latzel/llm-chat-skill';

const config = new SkillRegistryConfiguration('/path/to/skills', WarningMode.Error);
```
