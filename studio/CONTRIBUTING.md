# Contributing to Sigilweaver Studio

For comprehensive development documentation, see **[sigilweaver.app/docs/developer/contributing/studio](https://sigilweaver.app/docs/developer/contributing/studio)**.

## Quick Reference

### Development Setup

```bash
cd studio

# Install dependencies
npm install

# Start dev server (browser mode)
npm run dev

# Start with Electron (requires two terminals)
# Terminal 1:
npm run dev
# Terminal 2:
npm run electron
```

Or from the repository root:

```bash
./scripts/dev.py --studio           # Browser mode
./scripts/dev.py --studio-electron  # With Electron
```

### Running Tests

```bash
cd studio
npm test
```

### Linting

```bash
cd studio
npm run lint
npm run lint:fix
```

## Key Documentation

| Topic               | Link                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Studio Patterns** | [sigilweaver.app/docs/developer/contributing/studio](https://sigilweaver.app/docs/developer/contributing/studio)             |
| **Adding Tools**    | [sigilweaver.app/docs/developer/contributing/adding-tools](https://sigilweaver.app/docs/developer/contributing/adding-tools) |
| **Code Style**      | [sigilweaver.app/docs/developer/contributing/code-style](https://sigilweaver.app/docs/developer/contributing/code-style)     |
| **Architecture**    | [sigilweaver.app/docs/developer/architecture/frontend](https://sigilweaver.app/docs/developer/architecture/frontend)         |
| **Testing**         | [sigilweaver.app/docs/developer/testing/frontend](https://sigilweaver.app/docs/developer/testing/frontend)                   |

## CLA Requirement

All contributors must sign an IP Assignment CLA. See [CONTRIBUTING.md](../CONTRIBUTING.md) in the repository root for details.
