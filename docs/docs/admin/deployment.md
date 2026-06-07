---
sidebar_position: 1
description: Deploy Sigilweaver Loom Server and Hub using Docker
---

# Deployment Guide

This guide covers how to deploy the Sigilweaver Loom server and hub components using Docker. This is suitable for both self-hosted environments and cloud deployments.

## Prerequisites

- [Docker Engine](https://docs.docker.com/engine/install/) (v24.0+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.20+)
- OpenSSL (for generating secrets)

## Quick Start (Production)

To get Sigilweaver Loom up and running quickly, follow these steps:

### 1. Clone the Repository or Download Docker Files

You'll need the `docker-compose.yml` and related configuration files.

```bash
git clone https://github.com/Sigilweaver/Loom.git
cd Loom/docker
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` to set your domain and other configuration options.

### 3. Generate Secrets

Sigilweaver Loom requires several secret keys for secure operation. Run the following commands to generate them:

```bash
mkdir -p .secrets

# Session secret for web interface security
openssl rand -hex 32 > .secrets/session_secret

# Secret key for signing tokens
openssl rand -hex 32 > .secrets/secret_key

# Secret for registering new servers to the hub
openssl rand -hex 32 > .secrets/server_registration_secret

# Database password
openssl rand -hex 16 > .secrets/postgres_password

# Encryption key for database connections
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" > .secrets/connection_encryption_key
```

:::warning Important
All secrets **must** be changed from their defaults. In production (`ENVIRONMENT=production`), Hub will refuse to start if `SESSION_SECRET` or `SECRET_KEY` are still set to `CHANGE_ME_IN_PRODUCTION`. In development mode (the default), a warning is logged instead. If `SERVER_REGISTRATION_SECRET` is empty, Hub will log a warning - any server can register without authentication.
:::

### 4. Build and Start

Build the containers and start the stack in detached mode:

```bash
docker compose build
docker compose up -d
```

### 5. Verify Deployment

Check the status of your containers:

```bash
docker compose ps
```

You can view logs with:

```bash
docker compose logs -f
```

## Architecture

The deployment consists of several services:

- **Hub**: The central orchestration platform (FastAPI + React).
- **Server**: The execution engine (Python + Polars).
- **Postgres**: Database for the Hub.
- **Nginx** (Optional): Reverse proxy (you may use your own).

## HTTPS with a Reverse Proxy (Caddy)

The base `docker-compose.yml` exposes the Hub over plain HTTP. For any
internet-facing deployment, put a TLS-terminating reverse proxy in front. A
ready-to-use Caddy overlay is provided in `docker/docker-compose.tls.yml`; it
obtains and renews certificates automatically (Let's Encrypt / ZeroSSL).

### 1. Point DNS at the host

Create an `A`/`AAAA` record (for example `loom.example.com`) that resolves to
the public IP of the host. Ports `80` and `443` must be reachable from the
internet for the ACME challenge.

### 2. Configure the TLS variables

Add to your `.env`:

```bash
CADDY_DOMAIN=loom.example.com
ACME_EMAIL=admin@example.com
CORS_ORIGINS=["https://loom.example.com"]

# Keep the app ports on loopback so only Caddy is internet-facing.
HUB_PORT=127.0.0.1:25802
SERVER_PORT=127.0.0.1:25811
```

While testing, set `CADDY_ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory`
to use Let's Encrypt staging and avoid hitting rate limits.

### 3. Start with both compose files

```bash
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
```

Caddy reverse-proxies to the Hub over the internal Docker network. The live
execution stream (Server-Sent Events) is forwarded without buffering, so
real-time updates keep working through the proxy.

:::tip
`CORS_ORIGINS` must be a **JSON array** of origins (not a comma-separated
list). An empty value will fail to parse and prevent the Hub from starting.
:::

## Remote Servers over Tailscale

By default the Hub reaches Servers over the internal Docker network, which
requires them to run on the same host (or an otherwise routable network). When
a Server runs somewhere the Hub cannot reach directly - a home lab, on-prem
box, or a separate VPC - join both ends to a [Tailscale](https://tailscale.com)
tailnet and let the Hub reach the Server by its MagicDNS name.

An example sidecar stack is provided in `docker/sidecar/`. It runs a Tailscale
sidecar and shares its network namespace with the Server, then advertises the
Server's MagicDNS name to the Hub via `PUBLIC_ENDPOINT_URL`:

```bash
cd docker/sidecar
cp .env.example .env   # set TS_AUTHKEY, TS_TAILNET, HUB_URL, and Hub credentials
docker compose -f docker-compose.tailscale.yml up -d
```

The key setting is `PUBLIC_ENDPOINT_URL`. A Server advertises the address the
Hub should use to reach it for health polling and execution dispatch. Without
it, the Server advertises its local bind address (`http://localhost:25811`),
which the Hub on another host cannot reach. Set it to the Server's MagicDNS
name, for example:

```bash
PUBLIC_ENDPOINT_URL=http://loom-server.tailnet-name.ts.net:25811
```

See `docker/sidecar/README.md` for the full walkthrough, including how the Hub
must also be on the tailnet.

## Updates

To update your deployment to the latest version:

```bash
git pull
docker compose build --pull
docker compose up -d
```

## Troubleshooting

If containers fail to start, check the logs for specific error messages:

```bash
docker compose logs service_name
```
