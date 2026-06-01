# get_skill_resource

Reads a resource file from a skill's `references/` or `assets/` directory.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `skill` | `string` | yes | The name of the skill to read from |
| `path` | `string` | yes | Relative path within the skill directory, e.g. `"references/REFERENCE.md"` or `"assets/template.json"` |

## Returns

The file contents on success.

Returns an error message if:
- the skill is not found
- the path is outside `references/` or `assets/`
- the file does not exist

## Example

```ts
import { GetSkillResourceTool } from '@johannes.latzel/llm-chat-skill';

const result = await tool.execute({ skill: 'my_skill', path: 'references/guide.md' });
// result.status === ResultStatus.Success
// result.result === "Guide content..."
```
