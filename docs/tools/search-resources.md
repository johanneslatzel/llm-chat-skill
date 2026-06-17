# search_resources

Search resource file contents across skills using a regular expression.
Matching lines are returned with line numbers. The pattern is matched
case-insensitively.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | yes | Regex pattern to search for (case-insensitive). Examples: `"deploy"`, `"TODO\|FIXME"`, `"\\berror\\b"` |
| `skill_name` | `string` | no | Restrict search to a specific skill |
| `resource_type` | `string` | no | Restrict to `references`, `assets`, or `sections` |

## Returns

Matching lines grouped by skill and resource file, with line numbers.
Returns a "No matches found" message when nothing matches.

Returns an error message if:
- the regex pattern is invalid
- the skill is not found
- `resource_type` is not one of `references`, `assets`, or `sections`

## Example

```ts
import { SearchResourcesTool } from '@johannes.latzel/llm-chat-skill';

const result = await tool.execute({ query: 'deploy' });
// result.status === ResultStatus.Success
// result.result === "Search results for \"deploy\" in 2 skills:
//
// my_skill (references/guide.md):
//   line 1: This is the deploy guide.
//   line 2: Follow the deployment steps.
//
// 2 matches across 2 skills."
```
