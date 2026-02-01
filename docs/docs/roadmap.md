---
sidebar_position: 10
---

# Roadmap

Strategic direction and planned features for the Sigilweaver platform.

**Target v1.0 Release: June 2026**

---

## Current Status

Sigilweaver is in **Private Beta**. The codebase is not yet public, but binaries and documentation are available for testing the distribution pipeline. The core platform is feature-complete for most data transformation workflows. Development now focuses on enterprise features, ecosystem expansion, and polish leading to a v1.0 public release.

### What Works Today

| Component         | Status           | Notes                                       |
| ----------------- | ---------------- | ------------------------------------------- |
| Studio            | Production-ready | All core tools, theming, keyboard shortcuts |
| Server            | Production-ready | Lazy execution, caching, Python export      |
| Hub               | Beta             | Multi-user orchestration, RBAC, scheduling  |
| Desktop Apps      | Production-ready | Electron and Tauri builds for all platforms |
| Docker Deployment | Production-ready | Compose templates with secret management    |

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
| Code Signing               | Eliminate OS warnings on first launch          | High     |
| Additional Connectors      | Native support for more databases and APIs     | High     |
| New Tools: Fuzzy Join      | Approximate string matching for joins          | Medium   |
| New Tools: Network Cluster | Graph-based clustering and community detection | Medium   |
| New Tools: Python          | Execute arbitrary Python code in workflows     | Medium   |
| Streaming Preview          | Incremental preview for large datasets         | Medium   |
| Expression Autocomplete    | Context-aware suggestions in formula editor    | Medium   |

### Hub

| Feature             | Description                                    | Priority |
| ------------------- | ---------------------------------------------- | -------- |
| OIDC Integration    | Single sign-on via external identity providers | High     |
| GUI Configuration   | Web-based server and connection management     | High     |
| Git Integration     | Version control for workflows stored in Hub    | High     |
| Demo Instance       | Public read-only Hub for evaluation            | Medium   |
| Execution Dashboard | Real-time monitoring of running workflows      | Medium   |
| Notifications       | Email and webhook alerts for execution status  | Medium   |

---

## Medium-Term Focus (Q3-Q4 2026)

### Platform

| Feature             | Description                                      |
| ------------------- | ------------------------------------------------ |
| Kubernetes Operator | Native CRDs for deploying Sigilweaver at scale   |
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
Sigilweaver is designed to run wherever your data lives. We will continue to prioritize on-premise and air-gapped deployment scenarios alongside cloud offerings.

### Code as Truth
Every visual workflow compiles to readable, executable Python. This transparency ensures auditability and eliminates vendor lock-in.

### Open Ecosystem and Licensing
The entire Sigilweaver suite is **free for all users** under the AGPL-3.0 license. There are no paid tiers, premium features, or usage limits.

A commercial license is available for organizations that cannot use AGPL-licensed software. This license provides the same functionality under different legal terms—it does not unlock additional features. The core platform will always remain open source.

---

## How to Influence the Roadmap

1. **GitHub Issues**: Feature requests and bug reports shape our priorities.
2. **Community Discussions**: Participate in design discussions for major features.
3. **Pull Requests**: Direct contributions are the fastest path to new features.

---

## Version History

For a detailed record of completed work, see the [Development History](./development-history.md).
