# Quick Start

## Prerequisites

- Node.js >= 18

## Installation

```sh
npm install @johannes.latzel/llm-chat-skill
```

## Basic usage

Create a skill file at `./skills/my-tool/SKILL.md`:

```markdown
---
name: my_tool
description: A demonstration skill
---

This skill provides guidance on using the my_tool tool suite.
```

Then load it programmatically:

```ts
import { SkillRegistry, SkillRegistryConfiguration, LoadSkillTool } from '@johannes.latzel/llm-chat-skill';

const config = new SkillRegistryConfiguration('./skills');
const registry = new SkillRegistry(config);
await registry.initialize();

const tool = new LoadSkillTool(registry);
const result = await tool.execute({ name: 'my_tool' });
console.log(result.result);
// "This skill provides guidance on using the my_tool tool suite."
```

## Reading reference files

If your skill has reference documents:

```ts
import { GetSkillResourceTool } from '@johannes.latzel/llm-chat-skill';

const readTool = new GetSkillResourceTool(registry);
const guide = await readTool.execute({ skill: 'my_tool', path: 'references/guide.md' });
```
