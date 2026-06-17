# set_skill_resource

Writes a resource into a skill — references, assets, or sections.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `skill_name` | `string` | yes | The name of the skill to write the resource to. |
| `resourceType` | `string` | yes | Resource type — must be `references`, `assets`, or `sections`. |
| `name` | `string` | yes | Resource identifier (e.g. `"guide"` for references/assets). For sections, must be one of: `purpose.md`, `inputs-outputs.md`, `constraints.md`, `workflow.md`, `decision-criteria.md`, `examples.md`, `anti-patterns.md`. |
| `content` | `string` | yes | Content to write. |

## Returns

A success message confirming the resource was written.

Returns an error message if:
- the skill is not found
- the resource type is not valid
- the resource name is not one of the predefined section names when using `sections` type
- the resource name or content length is outside configured bounds
- writing to sections on a non-structured (plain) skill

## Examples

### Writing a reference

```ts
import { SetSkillResourceTool } from '@johannes.latzel/llm-chat-skill';

const result = await tool.execute({
    skill_name: 'my_skill',
    resourceType: 'references',
    name: 'guide.md',
    content: '# Reference Guide\n\nAdditional documentation...'
});
// result.status === ResultStatus.Success
// result.result === "Resource 'guide.md' of type 'references' written to skill 'my_skill'."
```

### Writing a section to a structured skill

```ts
const result = await tool.execute({
    skill_name: 'my_skill',
    resourceType: 'sections',
    name: 'purpose.md',
    content: '# Purpose\n\nThis skill handles code review.'
});
// result.status === ResultStatus.Success
// The skill body is recomposed from all section files.
```
