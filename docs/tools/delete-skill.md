# delete_skill

Deletes a skill from disk and removes it from the registry. The entire skill
subdirectory (including `SKILL.md`, `references/`, `assets/`, and `sections/`)
is removed.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | yes | The name of the skill to delete. |

## Returns

A success message confirming the deletion.

Returns an error message if:
- the skill is not found

## Example

```ts
import { DeleteSkillTool } from '@johannes.latzel/llm-chat-skill';

const result = await tool.execute({ name: 'my_skill' });
// result.status === ResultStatus.Success
// result.result === "Skill 'my_skill' deleted successfully."
```
