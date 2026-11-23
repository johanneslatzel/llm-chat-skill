# Configuration

## SkillRegistryConfiguration

Controls the skill directory path, warning behavior, length bounds for skill and resource fields, and the size of the `get_skill_resource` not-found hint.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `skillDir` | `string` | `LLM_CHAT_SKILL_DIR` or `""` | Path to the directory containing skill files |
| `warnings` | `WarningMode` | `LLM_CHAT_SKILL_WARNINGS` or `WarningMode.Silent` | How warnings during loading are handled |
| `maxHintResourceNames` | `number` | `LLM_CHAT_SKILL_MAX_HINT_RESOURCE_NAMES` or `8` | Maximum number of resource identifiers listed in the `get_skill_resource` not-found hint |
| `skillNameMinLength` | `number` | `5` | Minimum skill name length |
| `skillNameMaxLength` | `number` | `60` | Maximum skill name length |
| `skillDescriptionMinLength` | `number` | `25` | Minimum skill description length |
| `skillDescriptionMaxLength` | `number` | `500` | Maximum skill description length |
| `skillBodyMinLength` | `number` | `300` | Minimum skill body length |
| `skillBodyMaxLength` | `number` | `20_000` | Maximum skill body length |
| `resourceNameMinLength` | `number` | `5` | Minimum resource file name length |
| `resourceNameMaxLength` | `number` | `60` | Maximum resource file name length |
| `resourceContentMinLength` | `number` | `1` | Minimum resource content length |
| `resourceContentMaxLength` | `number` | `10_000` | Maximum resource content length |

### Constructor

```ts
new SkillRegistryConfiguration(skillDir?: string, warnings?: WarningMode, maxHintResourceNames?: number)
```

The constructor arguments override the environment variables, which in turn override the default constants.

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


## See also

- [Registry](index.md): `SkillRegistry` and listing
- [Skill file format](skill-format.md): anatomy of a `SKILL.md` file
- [Environment variables](../env.md): configuration reference
