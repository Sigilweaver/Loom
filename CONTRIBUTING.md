# Contributing to Sigilweaver

Welcome! This document covers the essentials to get you started.

For comprehensive developer documentation, visit **[docs.sigilweaver.app/developer](https://docs.sigilweaver.app/developer)**.

## Before You Contribute: The CLA

Sigilweaver requires all contributors to sign an **IP Assignment CLA** before we can merge your pull request.

### Why an IP Assignment?

I'll be direct: **I need to eat.**

When you contribute code, you assign the intellectual property to Sigilweaver Holdings LLC. This allows me to offer commercial licensing options to organizations that need them—which funds continued development of Sigilweaver.

I know IP assignment CLAs can feel uncomfortable. Here's why I believe this one is different:

**Contractual safeguards in the operating charter:**
- Any relicensing of Sigilweaver **must be to an OSI-approved license**
- Any transfer of IP ownership **must be to a 501(c)(3) nonprofit organization**

These aren't just promises—they're legally binding constraints on the holding company.

**What this means in practice:**
- The project stays open source forever—it cannot be closed
- You can always fork, use, and modify Sigilweaver under the AGPL
- Commercial licensing funds development without relying on donations
- If the project changes hands, it goes to a nonprofit, not a corporation

**What this does NOT mean:**
- Your code won't be "stolen" and locked away—it's always AGPL
- I cannot sell the IP to a company that would close-source it

The CLA will be presented when you open your first pull request.

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/sigilweaver/sigilweaver.git
cd sigilweaver

# Start everything (Server + Studio + Hub)
./scripts/dev.py
```

That's it. The dev script handles dependency installation, database setup, and launching all services.

### Selective Development

```bash
./scripts/dev.py --server    # Server only (port 8000)
./scripts/dev.py --studio    # Studio only (port 5173)
./scripts/dev.py --hub       # Hub only (backend: 58001, frontend: 5174)
./scripts/dev.py --electron  # Full stack + Electron desktop app
```

---

## Where to Contribute

| Area | Description | Documentation |
|------|-------------|---------------|
| **Studio** | Desktop app (React/Electron) | [Studio Guide](https://docs.sigilweaver.app/developer/contributing/studio) |
| **Server** | Execution engine (Python/FastAPI) | [Server Guide](https://docs.sigilweaver.app/developer/contributing/server) |
| **Hub** | Orchestration platform | [Hub Guide](https://docs.sigilweaver.app/developer/contributing/hub) |
| **Docs** | Documentation site (Docusaurus) | [docs/README.md](docs/README.md) |
| **Website** | Marketing site (Vite) | [site/README.md](site/README.md) |

---

## Development Workflow

1. **Fork and clone** the repository
2. **Create a branch** (`feature/your-feature` or `fix/issue-123`)
3. **Make your changes** following our [code style guide](https://docs.sigilweaver.app/developer/contributing/code-style)
4. **Test your changes** (`./scripts/test.py`)
5. **Open a pull request**

For detailed workflow documentation, see [Contributing Workflow](https://docs.sigilweaver.app/developer/contributing/workflow).

---

## Getting Help

- **Documentation**: [docs.sigilweaver.app](https://docs.sigilweaver.app)
- **Issues**: [GitHub Issues](https://github.com/sigilweaver/sigilweaver/issues)
- **Code of Conduct**: [docs.sigilweaver.app/code-of-conduct](https://docs.sigilweaver.app/code-of-conduct)

## License

Sigilweaver is licensed under AGPLv3. By contributing, you agree that your contributions will be licensed under the same license, and you agree to the terms of the CLA.

See [LICENSE](LICENSE) for details.

---

Thank you for contributing to Sigilweaver.
