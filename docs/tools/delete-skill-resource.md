# delete_skill_resource

Deletes a resource from a skill — references, assets, or sections. Does not error if the resource does not already exist. Deleting a section triggers a body recomposition for structured skills.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `skill_name` | `string` | yes | The name of the skill to delete the resource from. |
| `resourceType` | `string` | yes | Resource type — must be `references`, `assets`, or `sections`. |
| `name` | `string` | yes | Resource identifier (e.g. `"guide"` for references/assets). For sections, must be one of: `purpose.md`, `inputs-outputs.md`, `constraints.md`, `workflow.md`, `decision-criteria.md`, `examples.md`, `anti-patterns.md`. |

## Returns

A success message confirming the resource was deleted.

Returns an error message if:
- the skill is not found
- the resource type is not valid
- the resource name is not one of the predefined section names when using `sections` type
- deleting from sections on a non-structured (plain) skill

## Example

```ts
import { DeleteSkillResourceTool } from '@johannes.latzel/llm-chat-skill';

const result = await tool.execute({
    skill_name: 'my_skill',
    resourceType: 'references',
    name: 'guide.md'
});
// result.status === ResultStatus.Success
// result.result === "Resource 'guide.md' of type 'references' deleted from skill 'my_skill'."
```
