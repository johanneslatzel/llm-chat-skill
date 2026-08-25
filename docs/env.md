# Environment Variables

All variables can be set in the shell, in a `.env` file, or via the `SkillRegistryConfiguration` constructor and properties. A `.env.example` is included.

## Skill directory and warnings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_CHAT_SKILL_DIR` | no | `""` | Directory containing skill subdirectories |
| `LLM_CHAT_SKILL_WARNINGS` | no | `"silent"` | Warning mode: `"silent"`, `"log"`, or `"error"` |

## Skill field length bounds

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_CHAT_SKILL_NAME_MIN_LENGTH` | no | `5` | Minimum skill name length |
| `LLM_CHAT_SKILL_NAME_MAX_LENGTH` | no | `60` | Maximum skill name length |
| `LLM_CHAT_SKILL_DESCRIPTION_MIN_LENGTH` | no | `25` | Minimum skill description length |
| `LLM_CHAT_SKILL_DESCRIPTION_MAX_LENGTH` | no | `500` | Maximum skill description length |
| `LLM_CHAT_SKILL_BODY_MIN_LENGTH` | no | `300` | Minimum skill body length |
| `LLM_CHAT_SKILL_BODY_MAX_LENGTH` | no | `20_000` | Maximum skill body length |

## Resource field length bounds

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_CHAT_RESOURCE_NAME_MIN_LENGTH` | no | `5` | Minimum resource file name length |
| `LLM_CHAT_RESOURCE_NAME_MAX_LENGTH` | no | `60` | Maximum resource file name length |
| `LLM_CHAT_RESOURCE_CONTENT_MIN_LENGTH` | no | `1` | Minimum resource content length |
| `LLM_CHAT_RESOURCE_CONTENT_MAX_LENGTH` | no | `10_000` | Maximum resource content length |

## Resource not-found hint

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_CHAT_SKILL_MAX_HINT_RESOURCE_NAMES` | no | `8` | Maximum number of resource identifiers listed in the `get_skill_resource` not-found hint |


## See also

- [Overview](index.md): package introduction
- [Configuration](registry/configuration.md): `SkillRegistryConfiguration` reference
