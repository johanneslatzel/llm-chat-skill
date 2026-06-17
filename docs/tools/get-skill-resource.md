# get_skill_resource

Reads a resource from a skill — references, assets, or sections.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `skill_name` | `string` | yes | The name of the skill to read from (e.g., `"notebook"`) |
| `resourceType` | `string` | yes | Resource type — must be `references`, `assets`, or `sections`. |
| `name` | `string` | yes | Resource identifier, e.g. `"guide"` or `"purpose"`. |

## Returns

The resource content on success.

Returns an error message if:
- the skill is not found
- the resource type is not valid
- the resource does not exist

## Example

```ts
import { GetSkillResourceTool } from '@johannes.latzel/llm-chat-skill';

const result = await tool.execute({
    skill_name: 'my_skill',
    resourceType: 'references',
    name: 'guide.md'
});
// result.status === ResultStatus.Success
// result.result === "Guide content..."
```
