# Architecture

The library has three layers:

## 1. Registry

`SkillRegistry` discovers, loads, and serves skills from a directory on disk. Each skill lives in its own subdirectory (`my-skill/SKILL.md`). `SkillRegistryConfiguration` controls the directory and warning behaviour.

## 2. Tools

Seven `Tool` subclasses that expose registry operations to an LLM:

- **load_skill** — retrieve a skill's full instructions (body auto-composed for structured skills)
- **get_skill_resource** — read a file from `references/`, `assets/`, or `sections/`
- **set_skill** — create or update a skill (omit body for a structured shell)
- **delete_skill** — remove a skill
- **set_skill_resource** — write a file into `references/`, `assets/`, or `sections/`
- **delete_skill_resource** — delete a file from `references/`, `assets/`, or `sections/`

## 3. Package

`SkillToolPackage` bundles all six tools into a single `ToolPackage` for `ToolSuite` registration, and provides a `tutorial()` with a skill-system usage guide.

When a `ChatService` is passed to `registry.initialize(service)`, the registry injects a `skills` prompt into the system prompt containing the current skill listing. The prompt automatically refreshes on every create, update, or delete.

## Skill file format

A `SKILL.md` file is Markdown with YAML frontmatter. The frontmatter must include `name` and `description`, and may include a `metadata` block with `tags` and `body-format`:

```markdown
---
name: my_skill
description: What this skill does
metadata:
  tags: [coding]
  body-format: plain
---
Full instructions for the LLM go here.
```

For **structured** skills (`body-format: structured`), the body is auto-composed from files in `sections/` and should not be set directly.

The `Skill` class handles serialisation, persistence, rename, removal, and resource file management (`references/`, `assets/`, `sections/`).
