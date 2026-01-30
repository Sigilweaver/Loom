# Contributing to Sigilweaver Studio

For comprehensive development documentation, see **[docs.sigilweaver.app/developer/contributing/studio](https://docs.sigilweaver.app/developer/contributing/studio)**.

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
| **Studio Patterns** | [docs.sigilweaver.app/developer/contributing/studio](https://docs.sigilweaver.app/developer/contributing/studio)             |
| **Adding Tools**    | [docs.sigilweaver.app/developer/contributing/adding-tools](https://docs.sigilweaver.app/developer/contributing/adding-tools) |
| **Code Style**      | [docs.sigilweaver.app/developer/contributing/code-style](https://docs.sigilweaver.app/developer/contributing/code-style)     |
| **Architecture**    | [docs.sigilweaver.app/developer/architecture/frontend](https://docs.sigilweaver.app/developer/architecture/frontend)         |
| **Testing**         | [docs.sigilweaver.app/developer/testing/frontend](https://docs.sigilweaver.app/developer/testing/frontend)                   |

## CLA Requirement

All contributors must sign an IP Assignment CLA. See [CONTRIBUTING.md](../CONTRIBUTING.md) in the repository root for details.
