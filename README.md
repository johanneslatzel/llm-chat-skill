# LLM Chat Skill

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![NPM](https://nodei.co/npm/@johannes.latzel/llm-chat-skill.svg?style=shields&data=n,v,u,d,s)](https://www.npmjs.com/package/@johannes.latzel/llm-chat-skill)
[![version](https://img.shields.io/github/package-json/v/johanneslatzel/llm-chat-skill)](https://github.com/johanneslatzel/llm-chat-skill/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](https://github.com/johanneslatzel/llm-chat-skill/pulls)
[![Feedback Welcome](https://img.shields.io/badge/feedback-welcome-brightgreen)](https://github.com/johanneslatzel/llm-chat-skill/discussions)
[![codecov](https://codecov.io/gh/johanneslatzel/llm-chat-skill/graph/badge.svg)](https://codecov.io/gh/johanneslatzel/llm-chat-skill)
[![CI](https://github.com/johanneslatzel/llm-chat-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/johanneslatzel/llm-chat-skill/actions/workflows/ci.yml)
[![Socket Badge](https://badge.socket.dev/npm/package/@johannes.latzel/llm-chat-skill/latest)](https://badge.socket.dev/npm/package/@johannes.latzel/llm-chat-skill/latest)
[![AI Assisted Yes](https://img.shields.io/badge/AI%20Assisted-Yes-green)](https://github.com/mefengl/made-by-ai)

Adds skill management tools so the LLM can create, load, search, and edit skills at runtime via tool calls. Plugs into the [llm-chat](https://github.com/johanneslatzel/llm-chat) ecosystem.

## Features

- supports unstructured skills with a single body (`SKILL.md`), and structured skills auto-composed from section files (`purpose.md`, `workflow.md`, `constraints.md`, etc.) with heading demotion
- resources per skill: `references/`, `assets/`, and `sections/` directories
- full-text regex search across all resources, filtered by skill or resource type
- wire a live skill listing into the system prompt, refreshed on every mutation
- configurable via config objects and env vars

## Prerequisites

- Node.js >= 18

## Installation

```bash
npm install @johannes.latzel/llm-chat-skill
```

## Documentation

Full documentation at **[johanneslatzel.github.io/llm-chat-skill/](https://johanneslatzel.github.io/llm-chat-skill/)**

## License

MIT — see [`LICENSE`](LICENSE).

## Contributing

Issues and PRs welcome at [github.com/johanneslatzel/llm-chat-skill](https://github.com/johanneslatzel/llm-chat-skill).
