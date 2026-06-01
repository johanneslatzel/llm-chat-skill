# load_skill

Loads the full instructions for a named skill, including a listing
of its available resource files (references and assets).

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | yes | The name of the skill to load (e.g., `"notebook"`, `"websearch"`) |

## Returns

The full skill body, followed by a `--- Resources ---` section listing
each available file (e.g. `references/guide.md`).

Returns an error message if the skill is not found.

## Example

```ts
import { LoadSkillTool } from '@johannes.latzel/llm-chat-skill';

const result = await tool.execute({ name: 'my_skill' });
// result.status === ResultStatus.Success
// result.result === "Full instructions...\n\n--- Resources ---\n\nreferences/guide.md"
```
