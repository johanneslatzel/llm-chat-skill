# set_skill

Creates a new skill or updates an existing one. If the skill does not exist
it is created; if it already exists its properties are updated. When
renaming (`new_name`), the skill folder on disk is also renamed.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | yes | The skill name. If the skill does not exist it is created; if it exists it is updated. |
| `description` | `string` | no | Short description. Required when creating a new skill, optional when updating. |
| `body` | `string` | no | Full instruction body (the markdown content after frontmatter). Optional when creating — omit to create a **structured** skill (body auto-composed from `sections/` files). If the skill is already structured, providing `body` returns an error. |
| `new_name` | `string` | no | New name for the skill (update only). When provided, the skill folder is renamed to match. |

## Returns

A success message describing what was changed (created, or which fields were updated).

Returns an error message if:
- validation fails (name, description, or body length outside configured bounds)
- body length is validated only for plain (non-structured) skills
- the skill name already exists during creation
- the skill is not found during update
- no update fields are provided for an existing skill
- `body` is provided for a structured skill (use `set_skill_resource` with `sections/` paths instead)

## Examples

### Plain skill (with body)

```ts
import { SetSkillTool } from '@johannes.latzel/llm-chat-skill';

const result = await tool.execute({
    name: 'my_skill',
    description: 'Instructions for performing a specific task',
    body: 'Step-by-step instructions for the LLM...'
});
// result.status === ResultStatus.Success
// result.result === "Skill 'my_skill' created successfully."
```

### Structured skill (no body — sections managed separately)

```ts
const result = await tool.execute({
    name: 'my_skill',
    description: 'Instructions for performing a specific task'
});
// result.status === ResultStatus.Success
// result.result === "Skill 'my_skill' created as structured shell."
```

### Update an existing skill

```ts
const result = await tool.execute({
    name: 'my_skill',
    description: 'Updated description',
    body: 'Updated instructions...'
});
// result.status === ResultStatus.Success
// result.result === "Skill 'my_skill' updated: description → '...', body updated."
```
