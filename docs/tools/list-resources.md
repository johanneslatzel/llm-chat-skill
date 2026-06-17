# list_resources

List resource files across all skills (or within a specific skill),
optionally filtered by resource type.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `skill_name` | `string` | no | Only list resources for a specific skill |
| `resource_type` | `string` | no | Only list resources of this type — `references`, `assets`, or `sections` |

## Returns

Resources grouped by skill and resource type. Returns a "No resources
found" message when nothing matches.

Returns an error message if:
- the skill is not found
- `resource_type` is not one of `references`, `assets`, or `sections`

## Example

```ts
import { ListResourcesTool } from '@johannes.latzel/llm-chat-skill';

const result = await tool.execute({ skill_name: 'my_skill' });
// result.status === ResultStatus.Success
// result.result === "Resources for my_skill:
//
// my_skill:
//     - references:
//         - guide.md
//     - assets:
//         - config.json
//
// Total: 2 resources."
```
