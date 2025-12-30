# Sigilweaver

**The visual data pipeline platform you always wished existed.**

Enterprise-grade power, accessible to everyone.

[Website](https://sigilweaver.app) | [Downloads](https://sigilweaver.app/downloads) | [Documentation](https://docs.sigilweaver.app)

---

## What is Sigilweaver?

Sigilweaver is more than a workflow designer - it's a complete data pipeline platform.

**Studio** lets you design workflows visually. Drag tools onto an infinite canvas, wire them together, watch your data flow. **Server** executes those workflows with blazing speed using Polars' lazy evaluation. **Hub** turns it all into a platform - centralizing workflow storage, managing multiple servers, scheduling automated runs, and providing team collaboration with enterprise-grade security.

Whether you're a data scientist prototyping on a laptop, a hobbyist automating reports at home, or an architect designing enterprise-scale ETL, Sigilweaver meets you where you are.

No row limits. No vendor lock-in. No SaaS subscription required. Just you, your data, and infrastructure you control.

## Why Sigilweaver?

### Zero Trust, Zero Compromise

Your data never leaves your infrastructure. Sigilweaver is designed for **self-hosting from day one**. Run it on your laptop, your homelab, or your enterprise Kubernetes cluster. The architecture is the same - only the scale changes.

### Lazy Evaluation

Powered by [Polars](https://pola.rs), Sigilweaver builds optimized query plans rather than executing transformations immediately. This means you can design pipelines on a 10 billion row dataset without loading it all into memory.

### No Row Limits

Unlike SaaS tools that throttle you at 10,000 rows, Sigilweaver processes what your hardware can handle. If it fits on your machine, it runs on your machine.

### Visual Clarity, Full Power

See your entire pipeline at a glance - branches, joins, transformations laid out spatially. Inspect data at any node. Debug visually. Understand intuitively.

## Our Philosophy

**"Enterprise Grade" does not mean "Enterprise Only."**

We build Sigilweaver with the security, reliability, and scalability that enterprises demand. But we believe those same qualities belong to everyone:

- **Self-Hosting First**: We actively encourage individuals to run their own Hub. Your personal data pipeline infrastructure should be as robust as a Fortune 500's.
- **No Artificial Limits**: The same codebase powers a hobbyist's Raspberry Pi and a company's server farm.
- **Community Ownership**: The AGPL license ensures Sigilweaver remains open forever. No rug-pulls. No sudden "premium tiers."

Enterprise grade means "it works when you need it." That's a promise we make to every user, whether you're processing CSV exports or financial transactions.

## The Platform

| Component | What It Does |
|-----------|--------------|
| **Studio** | Desktop app for visual workflow design (React + Electron) |
| **Server** | Execution engine that runs workflows (FastAPI + Polars) |
| **Hub** | Orchestration platform for teams and automation (Full stack) |

Use Studio + Server for single-user local development. Add Hub when you need centralized storage, scheduling, multi-server management, or team collaboration.

See individual component READMEs for more details: [server/](server/README.md), [studio/](studio/README.md), [hub/](hub/README.md)

## Installation

Download the latest release for your platform from the **[Downloads Page](https://sigilweaver.app/downloads)**.

For development setup, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

| Audience | Link |
|----------|------|
| **Getting Started** | [docs.sigilweaver.app/user](https://docs.sigilweaver.app/user) |
| **Coming from Alteryx/KNIME?** | [Crash Courses](https://docs.sigilweaver.app/user/crash-courses) |
| **Developers** | [docs.sigilweaver.app/developer](https://docs.sigilweaver.app/developer) |
| **Architecture Decisions** | [ADRs](https://docs.sigilweaver.app/developer/architecture/decisions) |

## License

Sigilweaver is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**.

- **Free forever**: Use, modify, and distribute without restriction.
- **Copyleft**: If you run a modified version as a network service, you must release your changes under AGPL.
- **Protection**: Large corporations cannot absorb this project without contributing back.

### Sustainability and the CLA

Open source needs to be sustainable. Sigilweaver requires contributors to sign a Contributor License Agreement (CLA). This allows the project maintainer to offer commercial licensing options to organizations that need them, which funds continued development.

**What this means for you:**
- The project stays AGPLv3 forever - no one can close the source
- Development remains funded without relying on donations or sponsorships
- You can always use, fork, and modify Sigilweaver under the AGPL

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on the CLA, and [LICENSE](LICENSE) for the full AGPL text.

## Team

| Role | Maintainer |
|------|------------|
| **Lead Developer** | [Nathan Riley](https://github.com/Nathan-D-R) |
| **Community Manager** | [Madalyn Riley](https://github.com/mads040205) |

---

<p align="center">
  <strong>Built for the community. Sustained by the community.</strong>
</p>