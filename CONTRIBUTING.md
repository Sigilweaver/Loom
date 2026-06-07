# Contributing to Sigilweaver Loom

Welcome! This document covers the essentials to get you started.

For comprehensive developer documentation, visit **[sigilweaver.app/docs/developer](https://sigilweaver.app/docs/developer)**.

## Before You Contribute: The CLA

Sigilweaver Loom requires all contributors to sign an **IP Assignment CLA** before we can merge your pull request.

### Why an IP Assignment?

Sigilweaver Loom is built to be a permanent, open source alternative to proprietary data science "walled gardens." To guarantee that independence and ensure the project remains viable for the long term, I need a single entity with unified copyright ownership - necessary to defend the AGPL license and enforce copyleft.

However, I know that assigning rights requires trust. **Trust is good, but binding legal safeguards are better.**

### The "Poison Pill" Defense

This CLA contains a specialized legal structure designed to safeguard the community. It acts as a "Dead Man's Switch" (or Poison Pill) to ensure the project can never be "captured" or closed-sourced by a third party.

**The Agreement acts as a two-way street:**
1.  **You give rights to Sigilweaver Holdings LLC:** This gives the project unified copyright ownership, necessary to defend the license and enforce copyleft.
2.  **Sigilweaver Holdings LLC gives a binding Covenant to you:**
    * The project **must** remain available under an OSI-approved Open Source license.
    * The IP **cannot** be transferred to a for-profit third party (via sale, hostile takeover, or lawsuit judgment).

**The "Teeth" (Reversion Clause):**
If the holding company ever violates these terms-or if a third party tries to seize the IP to close it-**the IP assignment automatically terminates.** Ownership of the code instantly reverts back to the individual contributors.

This ensures that Sigilweaver Loom acts like a community-owned project (similar to Linux) if the holding company ever fails its mission.

You can read the full legal text of the agreement at **[CLA.md](./CLA.md)**.

The CLA will be presented automatically when you open your first pull request.

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Sigilweaver/Loom.git
cd Loom

# Start everything (Server + Studio + Hub)
./scripts/dev.py
```

That's it. The dev script handles dependency installation, database setup, and launching all services.

### Selective Development

```bash
./scripts/dev.py --server           # Server only (port 25811)
./scripts/dev.py --studio           # Studio only (port 25810)
./scripts/dev.py --hub              # Hub only (backend: 25802, frontend: 25803)
./scripts/dev.py --studio-electron  # Full stack + Electron desktop app
```

---

## Where to Contribute

| Area        | Description                       | Documentation                                                              |
| ----------- | --------------------------------- | -------------------------------------------------------------------------- |
| **Studio**  | Desktop app (React/Electron)      | [Studio Guide](https://sigilweaver.app/docs/developer/contributing/studio) |
| **Server**  | Execution engine (Python/FastAPI) | [Server Guide](https://sigilweaver.app/docs/developer/contributing/server) |
| **Hub**     | Orchestration platform            | [Hub Guide](https://sigilweaver.app/docs/developer/contributing/hub)       |
| **Docs**    | Documentation site (Docusaurus)   | [docs/README.md](docs/README.md)                                           |
| **Website** | Marketing site (Vite)             | [site/README.md](site/README.md)                                           |

---

## Development Workflow

1. **Fork and clone** the repository
2. **Create a branch** (`feature/your-feature` or `fix/issue-123`)
3. **Make your changes** following our [code style guide](https://sigilweaver.app/docs/developer/contributing/code-style)
4. **Test your changes** (`./scripts/test.py`)
5. **Open a pull request**

For detailed workflow documentation, see [Contributing Workflow](https://sigilweaver.app/docs/developer/contributing/workflow).

---

## Getting Help

- **Documentation**: [sigilweaver.app/docs](https://sigilweaver.app/docs)
- **Issues**: [GitHub Issues](https://github.com/Sigilweaver/Loom/issues)
- **Code of Conduct**: [sigilweaver.app/docs/code-of-conduct](https://sigilweaver.app/docs/code-of-conduct)

## License

Sigilweaver Loom is licensed under AGPLv3 for the core programs, and CC BY-SA 4.0 for documentation and the website.

By contributing, you agree that your contributions will be licensed under these licenses, and you agree to the terms of the CLA.

See [LICENSE](LICENSE.md) for details.

---

Thank you for contributing to Sigilweaver Loom.
