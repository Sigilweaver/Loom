# Contributing to Sigilweaver Loom Server

For comprehensive development documentation, see **[sigilweaver.app/docs/developer/contributing/server](https://sigilweaver.app/docs/developer/contributing/server)**.

## Quick Reference

### Development Setup

```bash
cd server

# Install dependencies
uv sync --all-extras

# Start dev server (hot reload)
uv run uvicorn app.main:app --reload --port 25811
```

Or from the repository root:

```bash
./scripts/dev.py --server
```

### Running Tests

```bash
cd server
uv run pytest tests/ -v
```

### Linting

```bash
cd server
uv run ruff check app/
uv run ruff format app/
```

## Key Documentation

| Topic               | Link                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Server Patterns** | [sigilweaver.app/docs/developer/contributing/server](https://sigilweaver.app/docs/developer/contributing/server)             |
| **Adding Tools**    | [sigilweaver.app/docs/developer/contributing/adding-tools](https://sigilweaver.app/docs/developer/contributing/adding-tools) |
| **Code Style**      | [sigilweaver.app/docs/developer/contributing/code-style](https://sigilweaver.app/docs/developer/contributing/code-style)     |
| **Architecture**    | [sigilweaver.app/docs/developer/architecture/backend](https://sigilweaver.app/docs/developer/architecture/backend)           |
| **Testing**         | [sigilweaver.app/docs/developer/testing/backend](https://sigilweaver.app/docs/developer/testing/backend)                     |

## CLA Requirement

All contributors must sign an IP Assignment CLA. See [CONTRIBUTING.md](../CONTRIBUTING.md) in the repository root for details.
