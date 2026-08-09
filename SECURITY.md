# Security Policy

## Supported Versions

Sigilweaver Loom is pre-1.0 (currently v0.12.0) and has not yet had a stable
v1.0 release. Only the latest pre-1.0 release receives security updates;
older pre-1.0 releases are not supported. Once v1.0 ships, this policy will
be updated to reflect a stable supported-version line.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please report them privately via [GitHub Security Advisories](https://github.com/Sigilweaver/Loom/security/advisories/new).

Include:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof of concept
- The component affected (Server, Studio, Hub)
- Your assessment of severity (low / medium / high / critical)

You should receive an initial acknowledgment within 72 hours. From there we will work with you to understand, validate, and address the issue before any public disclosure.

## Scope

The following are in scope:

- **Server** (Python/FastAPI): SQL injection, command injection, path traversal, authentication/authorization bypass
- **Studio** (Electron/Tauri): local privilege escalation, unsafe IPC, arbitrary file read/write outside of user-initiated file dialogs
- **Hub** (FastAPI): authentication bypass, RBAC escalation, cross-tenant data access, session fixation
- **Build/release pipeline**: supply chain issues, unsigned artifacts, manifest tampering

The following are out of scope:

- Vulnerabilities in third-party dependencies with no demonstrated exploit path in Sigilweaver Loom
- Denial of service via large workflow files (this is a desktop application that processes user-provided data by design)
- Self-XSS or attacks requiring physical access to the machine running Studio

## Disclosure Policy

We follow coordinated disclosure. We will credit reporters in the release notes (unless you prefer to remain anonymous) and aim to release a fix within 30 days of validation for high/critical issues.
