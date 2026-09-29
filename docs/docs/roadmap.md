---
sidebar_position: 10
title: Roadmap
---

# Roadmap

Where Sigilweaver Loom stands today and what stands between it and a 1.0 release.

This page does not promise dates. Items move as the project learns what matters. The [CHANGELOG](https://github.com/Sigilweaver/Loom/blob/main/CHANGELOG.md) is the record of what has shipped.

## Where things stand

Loom is **pre-1.0**. There has been no stable release yet, so expect breaking changes between versions and some rough edges. The 0.13 line is meant to be a solid base: consistent tooling, security hardening, honest documentation and a repeatable release process. Feature work builds on it.

| Component         | Status     | Notes                                                                                      |
| ----------------- | ---------- | ------------------------------------------------------------------------------------------ |
| Studio            | Beta       | 13 tools, tabs, undo/redo, themes, data preview and profiling, optional AI assistant.      |
| Server            | Beta       | Lazy Polars execution, disk caching of blocking tools, Python code export, Hub integration. |
| Desktop apps      | Beta       | Releases ship Electron builds in a Full (bundled Server) and a Client variant, plus a web build. Tauri builds exist but are not part of the release yet. Windows builds are code signed. macOS builds are not notarized and target x64. |
| Docker deployment | Beta       | Compose files for Hub, Server and PostgreSQL with secret handling. Images are amd64 only.  |
| Hub               | Open beta  | Users, roles, groups, shared connections, scheduling, audit log. See [Hub Open Beta](./admin/hub-beta.md) for the current limitations. |

Beta here means the features work and are tested, but file formats, configuration keys and APIs may still change, and there are known gaps.

## The path to 1.0

Loom reaches 1.0 when these are true:

1. **Stable contracts.** The `.swwf` workflow format, the Server API and the Hub `/api/v1` API have compatibility rules, and breaking changes come with a documented migration.
2. **A security posture we can state plainly.** Expression evaluation, file access, connection credentials and Hub tokens have been reviewed, and the [Security Model](./admin/security.md) describes exactly what is and is not guaranteed.
3. **Hub is dependable for teams.** Executions and schedules survive restarts, and Hub can run more than one replica.
4. **Releases are boring.** Every platform build is produced by CI, checksummed and installable without workarounds.
5. **The docs match the code.** Every tool, setting and environment variable is documented and checked before each release.

## Focus areas

These are directions, roughly grouped. They are not ordered and not scheduled.

### Studio

- Theme editor (a GUI for creating and editing themes)
- Workflow templates for common tasks
- Tool search in the palette
- Incremental preview for very large datasets
- UI for Hub features that exist only in the API today, such as workflow revisions and execution artifacts

### Server

- More native database connectors
- More tools. Ideas include fuzzy join, network clustering and a Python code tool. None of these has been designed yet.
- Cloud storage sources (S3, GCS, Azure Blob)
- Native ARM64 builds

### Hub

Hub is in open beta. The gaps that matter most:

- Durable executions. Today a running execution is tracked in memory and is lost if Hub restarts.
- Multi-replica scheduling. Today the scheduler runs inside the Hub process, so run a single replica.
- A working Settings page in the admin area (it is a placeholder today)
- Per-user API tokens for automation
- OIDC and single sign-on
- Notifications (email and webhooks) for execution status

### Platform and release

- Notarized macOS builds
- Helm charts and a Kubernetes deployment guide
- Broader testing on macOS and on Linux with X11

## Already shipped

Some items that earlier versions of this page listed as future work are in place:

| Area   | Feature                                                                                       |
| ------ | --------------------------------------------------------------------------------------------- |
| Hub    | Audit log browser with hash-chain verification (Admin > Audit Log)                            |
| Hub    | Workflow version history in the web app: list, diff, download and restore                     |
| Hub    | Execution artifacts: outputs stored as CSV and downloadable through the API (API only, no UI) |
| Hub    | Live execution updates over server-sent events                                                |
| Hub    | Web-based management of servers, connections, users, groups and grant groups                  |
| Studio | AI assistant with several model providers                                                    |
| Studio | Data profiling and Python code export                                                         |

## Long-term principles

- **Local first, cloud capable.** Loom runs wherever your data lives, including air-gapped networks.
- **Code as truth.** A visual workflow can be exported as readable Polars code, so nothing is locked in.
- **Open.** The whole suite is AGPL-3.0, with no paid tiers.

## Influence the roadmap

- Open or upvote a [GitHub issue](https://github.com/Sigilweaver/Loom/issues).
- Join a [discussion](https://github.com/Sigilweaver/Loom/discussions) about a larger change before you build it.
- Send a pull request. See the [Contributing Workflow](./developer/contributing/workflow.md).
