---
sidebar_position: 1
---

# Developer Guide

Welcome to the Sigilweaver developer documentation.

## Who This Is For

If you're reading this, you're probably:
- A developer who wants to contribute tools, features, or fixes
- Someone evaluating the codebase before deciding to contribute
- Me, six months from now, trying to remember why I made certain decisions

This guide assumes you're comfortable with Python and/or TypeScript. You don't need to be an expert in React, FastAPI, or Polars—but you should know your way around a terminal and a debugger.

## Honest State of the Project

Sigilweaver is pre-v1.0. The architecture is solid, the core works, but there's plenty of rough edges:

- **What's stable**: Workflow execution, tool registry, state management, serialization
- **What's evolving**: UI polish, tool configuration panels, error handling UX
- **What's missing**: Some tool implementations, comprehensive user docs, macOS testing

I'm building this because I genuinely want to use it. That means I prioritize correctness over features, and simplicity over cleverness. Contributions that align with that philosophy are welcome.

## Why Contribute?

A few honest reasons:

1. **You'll actually use it.** The best contributors are users who hit a limitation and fix it themselves.

2. **The codebase is approachable.** Domain-driven design means most changes are localized. Adding a tool doesn't require understanding the whole system.

3. **It's AGPL-3.0.** Your contributions remain open forever. No bait-and-switch to proprietary.

4. **The maintainer (hi) is responsive.** I review PRs, answer questions, and value good-faith contributions.

## Where to Start

| Goal | Start Here |
|------|------------|
| Set up your dev environment | [Getting Started](./getting-started) |
| Understand how things fit together | [Architecture Overview](./architecture/overview) |
| Add a new tool | [Adding Tools](./contributing/adding-tools) |
| Fix a bug | [Contributing Workflow](./contributing/workflow) |
| Run the test suite | [Testing Philosophy](./testing/philosophy) |
| Build a release | [Packaging](./building/packaging) |

## Communication

- **Bug reports**: [GitHub Issues](https://github.com/sigilweaver/sigilweaver-app/issues)
- **Feature discussions**: [GitHub Discussions](https://github.com/sigilweaver/sigilweaver-app/discussions)
- **Questions**: Open an issue or discussion—I prefer public channels so answers help others

## Guiding Principles

These show up throughout the codebase and documentation:

- **Ship, then polish.** Working software beats perfect plans.
- **Test the bones, not the skin.** Core logic gets heavy testing; UI gets light testing.
- **Explicit over magic.** Configuration and behavior should be predictable and traceable.
- **Every feature has maintenance cost.** Say no to scope creep.
- **Honest documentation.** If something's broken, say so. If a decision was a tradeoff, explain why.

---

Ready to dive in? Start with [Getting Started](./getting-started).
