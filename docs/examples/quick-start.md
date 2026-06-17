# Quick Start

## Prerequisites

- Node.js >= 18

## Installation

```sh
npm install @johannes.latzel/llm-chat-skill
```

## Basic usage — plain skill

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

## Structured skill

A **structured** skill breaks its body into separate sections managed via the resource tools. Create one via `set_skill` by omitting the body:

```ts
import { SkillRegistry, SkillToolPackage, SetSkillTool, SetSkillResourceTool, LoadSkillTool } from '@johannes.latzel/llm-chat-skill';

const registry = new SkillRegistry();
await registry.initialize();

// Create a structured shell (no body)
const setTool = new SetSkillTool(registry);
await setTool.execute({
    name: 'code_review',
    description: 'Code review guidelines'
});

// Add sections
const resourceTool = new SetSkillResourceTool(registry);
await resourceTool.execute({
    skill_name: 'code_review',
    resourceType: 'sections',
    name: 'purpose.md',
    content: '# Purpose\n\nEnsure code quality.'
});
await resourceTool.execute({
    skill_name: 'code_review',
    resourceType: 'sections',
    name: 'rules.md',
    content: '# Rules\n\n1. No debug logs\n2. Handle errors'
});

// Load it — body is auto-composed from sections
const loadTool = new LoadSkillTool(registry);
const result = await loadTool.execute({ name: 'code_review' });
console.log(result.result);
// "## Purpose\n\nEnsure code quality.\n\n## Rules\n\n1. No debug logs\n2. Handle errors\n\n--- Resources ---\n\nsections/purpose.md\nsections/rules.md"
```

## Tutorial

The `SkillToolPackage` provides a tutorial via `tutorial()` that explains how to use the skill system tools:

```ts
import { SkillRegistry, SkillToolPackage } from '@johannes.latzel/llm-chat-skill';

const registry = new SkillRegistry();
const pkg = new SkillToolPackage(registry);

console.log(pkg.tutorial()); // Full guide content
```

## Using the SkillToolPackage

For integration with a `ChatService` from `@johannes.latzel/llm-chat`, use the `SkillToolPackage` to register all six tools at once:

```ts
import { SkillRegistry, SkillToolPackage } from '@johannes.latzel/llm-chat-skill';

const registry = new SkillRegistry(config);
await registry.initialize(service);       // loads skills + wires "skills" prompt
service.tools().add(new SkillToolPackage(registry));  // registers all 6 tools
```

Passing your `ChatService` to `initialize()` adds a `skills` prompt to the system prompt with the current skill listing, and automatically refreshes it when skills are created, updated, or deleted via tool calls.

If you are using `ToolSuite` directly (without a `ChatService`):

```ts
import { ToolSuite } from '@johannes.latzel/llm-chat';
import { SkillRegistry, SkillToolPackage } from '@johannes.latzel/llm-chat-skill';

const registry = new SkillRegistry();
await registry.initialize();

const suite = new ToolSuite();
suite.add(new SkillToolPackage(registry));

// suite now has all 6 skill tools registered
const tools = suite.getTools(); // OpenAI-compatible tool definitions
```

## Reading reference files

If your skill has reference documents:

```ts
import { GetSkillResourceTool } from '@johannes.latzel/llm-chat-skill';

const readTool = new GetSkillResourceTool(registry);
const guide = await readTool.execute({ skill_name: 'my_tool', resourceType: 'references', name: 'guide.md' });
```
