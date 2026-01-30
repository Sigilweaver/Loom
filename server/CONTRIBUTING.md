# Contributing to Sigilweaver Server

For comprehensive development documentation, see **[docs.sigilweaver.app/developer/contributing/server](https://docs.sigilweaver.app/developer/contributing/server)**.

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
| **Server Patterns** | [docs.sigilweaver.app/developer/contributing/server](https://docs.sigilweaver.app/developer/contributing/server)             |
| **Adding Tools**    | [docs.sigilweaver.app/developer/contributing/adding-tools](https://docs.sigilweaver.app/developer/contributing/adding-tools) |
| **Code Style**      | [docs.sigilweaver.app/developer/contributing/code-style](https://docs.sigilweaver.app/developer/contributing/code-style)     |
| **Architecture**    | [docs.sigilweaver.app/developer/architecture/backend](https://docs.sigilweaver.app/developer/architecture/backend)           |
| **Testing**         | [docs.sigilweaver.app/developer/testing/backend](https://docs.sigilweaver.app/developer/testing/backend)                     |

## CLA Requirement

All contributors must sign an IP Assignment CLA. See [CONTRIBUTING.md](../CONTRIBUTING.md) in the repository root for details.
