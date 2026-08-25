# Architecture

The library has three layers:

## 1. Registry

`SkillRegistry` discovers, loads, and serves skills from a directory on disk. Each skill lives in its own subdirectory (`my-skill/SKILL.md`). `SkillRegistryConfiguration` controls the directory and warning behaviour.

## 2. Tools

Eight `Tool` subclasses that expose registry operations to an LLM. See [Tools](tools/index.md) for the full list with parameter references.

## 3. Package

`SkillToolPackage` bundles all eight tools into a single `ToolPackage` for registration with a `ChatService`, and provides a `tutorial()` with a skill-system usage guide.

A `ChatService` passed to `registry.initialize(service)` wires the skill listing into the system prompt (see [Registry](registry/index.md)).

## Skill file format

Skills are stored as `SKILL.md` files with YAML frontmatter. See [Skill file format](registry/skill-format.md) for the directory layout, plain vs structured skills, and length constraints.


## See also

- [Overview](index.md): package introduction
- [Registry](registry/index.md): `SkillRegistry` and configuration
- [Tools](tools/index.md): the eight skill tools
