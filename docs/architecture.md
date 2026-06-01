# Architecture

## Overview

The library is built around three core concepts: **Registry**, **Tools**, and **File Format**.

```
SkillRegistry
 ├── SkillRegistryConfiguration — directory path, warning mode
 ├── initialize() — scans directory for SKILL.md files
 ├── list() — returns all loaded Skill instances
 ├── get(name) — retrieve a Skill by name
 └── listing() — formatted string of available skills (for system prompts)

Skill class
 ├── save() / remove() / rename() / update() — lifecycle
 ├── getResource(resource, name) — read a file from references/ or assets/
 ├── setResource(resource, name, content) — write a file
 ├── deleteResource(resource, name) — delete a file
 └── listResources() — enumerate all files in references/ and assets/

Tools (extend Tool from llm-chat)
 ├── LoadSkillTool — loads skill body by name
 ├── GetSkillResourceTool — reads files from a skill's resource directories
 ├── SetSkillTool — create and update skills
 ├── DeleteSkillTool — delete skills
 ├── SetSkillResourceTool — write resource files
 └── DeleteSkillResourceTool — delete resource files

Skill file (SKILL.md)
 ├── YAML frontmatter (name, description required)
 └── body — full instructions for the LLM
```

- **SkillRegistry** — the core class that discovers, parses, and stores skills. Skills live in subdirectories (`my-skill/SKILL.md`) within a configured directory.
- **SkillRegistryConfiguration** — controls the skill directory path and how warnings during loading are handled.
- **Skill** — represents a single skill and provides methods for filesystem operations (persistence, rename, remove) and resource file management.
- **SkillResource** — enum (`Assets`, `References`) identifying the two allowed resource subdirectories.
- **LoadSkillTool** — retrieves the full body of a named skill, together with a listing of its available reference and asset files. Use this when the LLM needs detailed guidance on a specific tool suite.
- **GetSkillResourceTool** — reads a resource file from a skill's `references/` or `assets/` directory.
- **SetSkillTool** — creates new skills and updates existing skills (including rename). The skill folder on disk is renamed when `new_name` is provided.
- **DeleteSkillTool** — deletes a skill from disk and removes it from the registry.
- **SetSkillResourceTool** — writes a resource file into a skill's `references/` or `assets/` directory.
- **DeleteSkillResourceTool** — deletes a resource file from a skill's `references/` or `assets/` directory.
- **Skill file format** — every skill is a Markdown file with YAML frontmatter containing at minimum a `name` and `description`.
