# Skill file format

A skill is a Markdown file named `SKILL.md` with YAML frontmatter.

## Layout

```markdown
---
name: my_skill
description: Brief description of what this skill provides
---

Full instructions and body content here...
```

## Placement

Skills live in a named subdirectory within the configured skill directory:

```
/path/to/skills/
  my-skill/
    SKILL.md
    references/guide.md
    assets/template.json
```

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Unique identifier for the skill (e.g., `my_skill`) |
| `description` | yes | Short description shown in listings |
| body | — | Full instructions (everything after the frontmatter) |

Each skill's `rootDir` points to the parent (configured skill directory), and its subdirectory is derived from the sanitised name. The `get_skill_resource`, `set_skill_resource`, and `delete_skill_resource` tools access files inside `references/` and `assets/`.
