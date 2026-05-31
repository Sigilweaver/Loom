---
sidebar_position: 10
---

# Roadmap

Strategic direction and planned features for the Sigilweaver Loom platform.

---

## Current Status

Sigilweaver Loom v1.0 has shipped. The core platform is feature-complete for most data transformation workflows. Development now focuses on platform features, ecosystem expansion, and continued polish.

The primary, fully-supported way to use Sigilweaver Loom is the **desktop app with its bundled server** - no external infrastructure required. **Hub** and a standalone **Server** are entirely optional, for teams that want centralized storage, scheduling, and multi-user orchestration. Hub is currently in **open beta**.

### What Works Today

| Component         | Status           | Notes                                       |
| ----------------- | ---------------- | ------------------------------------------- |
| Studio            | Production-ready | All core tools, theming, keyboard shortcuts |
| Server            | Production-ready | Lazy execution, caching, Python export      |
| Desktop Apps      | Production-ready | Bundled server, Electron and Tauri builds for all platforms |
| Docker Deployment | Production-ready | Compose templates with secret management    |
| Hub (optional)    | Open beta        | Multi-user orchestration, RBAC, scheduling  |

---

## Near-Term Focus (Q1-Q2 2026)

### Studio

| Feature            | Description                                  | Priority |
| ------------------ | -------------------------------------------- | -------- |
| Theme Editor       | GUI for creating and modifying themes        | Medium   |
| Workflow Templates | Pre-built workflow patterns for common tasks | Medium   |
| Tool Search        | Quick-find for tools by name or function     | Low      |

### Server

| Feature                    | Description                                    | Priority |
| -------------------------- | ---------------------------------------------- | -------- |
| Additional Connectors      | Native support for more databases and APIs     | High     |
| New Tools: Fuzzy Join      | Approximate string matching for joins          | Medium   |
| New Tools: Network Cluster | Graph-based clustering and community detection | Medium   |
| New Tools: Python          | Execute arbitrary Python code in workflows     | Medium   |
| Streaming Preview          | Incremental preview for large datasets         | Medium   |

### Hub (optional, open beta)

| Feature              | Description                                          | Priority |
| -------------------- | --------------------------------------------------- | -------- |
| Auditor Experience   | UI for browsing the audit log and verifying its hash chain | High     |
| Execution Artifacts  | Store and retrieve workflow outputs from Hub        | High     |
| Workflow Versioning  | Internal revision history with diff and rollback    | High     |
| GUI Configuration    | Web-based server and connection management          | High     |
| Per-User API Tokens  | Scoped tokens for automation                        | Medium   |
| Execution Dashboard  | Real-time monitoring of running workflows           | Medium   |
| Demo Instance        | Public read-only Hub for evaluation                 | Medium   |

#### Deferred to v1.x

These were previously listed as near-term but are intentionally deferred so the
roadmap reflects what is actually shipping:

| Feature           | Description                                          | Notes                                    |
| ----------------- | --------------------------------------------------- | ---------------------------------------- |
| OIDC / SSO        | Single sign-on via external identity providers      | Scoping in progress; API tokens land first |
| Git Remote Sync   | Sync Hub workflow revisions to an external Git remote | Builds on internal versioning           |
| Notifications     | Email and webhook alerts for execution status       | Under consideration; not yet committed   |

---

## Medium-Term Focus (Q3-Q4 2026)

### Platform

| Feature             | Description                                      |
| ------------------- | ------------------------------------------------ |
| Kubernetes Operator | Native CRDs for deploying Sigilweaver Loom at scale   |
| Helm Charts         | Standardized deployment templates for Kubernetes |
| ARM64 Builds        | Native support for Apple Silicon and ARM servers |

### Ecosystem

| Feature           | Description                                  |
| ----------------- | -------------------------------------------- |
| API Connectors    | REST/GraphQL tool for fetching external data |
| Cloud Storage     | Native S3, GCS, and Azure Blob support       |
| Streaming Sources | Kafka and Redpanda connectors                |

### Intelligence

| Feature            | Description                                                                         |
| ------------------ | ----------------------------------------------------------------------------------- |
| AI-Assisted Design | Natural language to workflow generation (optional, off by default, user-configured) |
| Smart Suggestions  | Context-aware tool recommendations (optional, off by default, user-configured)      |
| Data Quality Rules | Built-in validation and anomaly detection                                           |

---

## Long-Term Vision

### Local-First, Cloud-Capable
Sigilweaver Loom is designed to run wherever your data lives. We will continue to prioritize on-premise and air-gapped deployment scenarios alongside cloud offerings.

### Code as Truth
Every visual workflow compiles to readable, executable Python. This transparency ensures auditability and eliminates vendor lock-in.

### Open Ecosystem and Licensing
The entire Sigilweaver Loom suite is **free for all users** under the AGPL-3.0 license. There are no paid tiers, premium features, or usage limits. The core platform will always remain open source.

---

## How to Influence the Roadmap

1. **GitHub Issues**: Feature requests and bug reports shape our priorities.
2. **Community Discussions**: Participate in design discussions for major features.
3. **Pull Requests**: Direct contributions are the fastest path to new features.

---

## Version History

For a detailed record of completed work, see `CHANGELOG.md` in the repository root.
