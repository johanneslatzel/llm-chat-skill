# Skill file format

A skill is a Markdown file named `SKILL.md` with YAML frontmatter.

## Layout

```markdown
---
name: my_skill
description: Brief description of what this skill provides
metadata:
  tags: [coding, python]
  body-format: plain
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
    sections/
      purpose.md
      inputs-outputs.md
      constraints.md
      workflow.md
      decision-criteria.md
      examples.md
      anti-patterns.md
```

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Unique identifier for the skill (e.g., `my_skill`) |
| `description` | yes | Short description shown in listings |
| `metadata.tags` | no | Array of tag strings for categorisation |
| `metadata.body-format` | no | Set to `"structured"` for skills whose body is auto-composed from `sections/` files. Omit or set to `"plain"` for a single body string. |
| body | — | Full instructions (everything after the frontmatter). For structured skills the body is auto-composed and should not be set directly. |

## Plain vs structured skills

A skill is **plain** by default (body-format absent or `"plain"`). Its body is a single markdown string written directly in `SKILL.md`.

A skill becomes **structured** when created without a body (`set_skill` with `name` and `description` only). Structured skills:
- Store body parts as separate files in `sections/`
- Only the following predefined section names are accepted: `purpose.md`, `inputs-outputs.md`, `constraints.md`, `workflow.md`, `decision-criteria.md`, `examples.md`, `anti-patterns.md`
- Auto-compose the body on write by concatenating section files in the predefined order (headings demoted one level, placed under an auto-generated level-1 heading)
- Reject direct body updates via `set_skill`

## Length constraints

| Constraint | Plain skill | Structured skill |
|---|---|---|
| Skill name | 5–60 chars | 5–60 chars |
| Description | 25–500 chars | 25–500 chars |
| Body | 300–20,000 chars (set directly) | Auto-composed from sections; body length not directly validated |
| Resource name | 5–60 chars | 5–60 chars |
| Resource content | 1–10,000 chars per file | 1–10,000 chars per section file (7 sections × 10,000 = 70,000 max effective body) |

Body length is enforced on `set_skill` for plain skills. Structured skills bypass the body length check because the body is auto-composed from individual sections (each capped at 10,000 chars via `set_skill_resource`).

Each skill's `rootDir` points to the parent (configured skill directory), and its subdirectory is derived from the sanitised name. The `get_skill_resource`, `set_skill_resource`, and `delete_skill_resource` tools access files inside `references/`, `assets/`, and `sections/`.
