---
sidebar_position: 2
title: Deployment Guide
description: Deploy Sigilweaver Loom Hub, PostgreSQL and Servers with Docker Compose
---

# Deployment Guide

Deploy Hub, PostgreSQL and a Server with Docker Compose. The compose files live in the [`docker/`](https://github.com/Sigilweaver/Loom/tree/main/docker) directory of the repository.

:::caution Open beta
Hub runs as a **single replica**. Executions and schedules live inside the Hub process. Read [Hub Open Beta](./hub-beta.md) before you plan for high availability.
:::

## What you get

| Service      | Image                                          | Port  | Purpose                                      |
| ------------ | ---------------------------------------------- | ----- | -------------------------------------------- |
| **postgres** | `postgres:16`                                  | 5432 (internal) | Hub database                        |
| **hub**      | `ghcr.io/sigilweaver/sigilweaver-loom-hub`     | 25802 | Web app, API, scheduler                      |
| **server**   | `ghcr.io/sigilweaver/sigilweaver-loom-server`  | 25811 | Workflow execution engine                    |
| **caddy** (optional) | `caddy:2`                              | 80, 443 | HTTPS reverse proxy (TLS overlay)          |

Hub serves both the API (`/api/v1`) and the web app on port 25802. The containers run as a non-root user with read-only root filesystems. Images are built for amd64 only.

## Prerequisites

- Docker Engine and Docker Compose v2
- OpenSSL, to generate secrets
- A host that Studio users can reach on the ports you publish

## Quick start

### 1. Get the compose files

```bash
git clone https://github.com/Sigilweaver/Loom.git
cd Loom/docker
```

### 2. Generate secrets

Hub refuses to start without four secrets, and PostgreSQL needs a password. The compose file reads them from files in `.secrets/`.

```bash
mkdir -p .secrets
chmod 700 .secrets

openssl rand -hex 32 > .secrets/session_secret
openssl rand -hex 32 > .secrets/secret_key
openssl rand -hex 32 > .secrets/server_registration_secret
openssl rand -hex 16 > .secrets/postgres_password

# Fernet key that encrypts stored connection credentials
openssl rand -base64 32 | tr '+/' '-_' | tr -d '\n' > .secrets/connection_encryption_key

chmod 600 .secrets/*
```

| Secret file                  | Used for                                                           |
| ---------------------------- | ------------------------------------------------------------------ |
| `session_secret`             | Signing Hub sessions                                               |
| `secret_key`                 | Legacy signing key. Still required, and must not be empty          |
| `connection_encryption_key`  | Encrypting connection credentials in the database                  |
| `server_registration_secret` | Shared secret that Servers present when they register              |
| `postgres_password`          | PostgreSQL password                                                |

:::warning Back up the encryption key
If you lose `connection_encryption_key`, every stored Hub connection becomes unrecoverable. Store a copy somewhere safe, apart from the database backups.
:::

### 3. Optional settings

Copy the example file if you want to change ports, the image version or CORS origins. Secrets stay in `.secrets/`, so leave the secret lines in `.env` empty.

```bash
cp .env.example .env
```

The variables that matter most:

| Variable        | Default                                        | Meaning                                                   |
| --------------- | ---------------------------------------------- | --------------------------------------------------------- |
| `VERSION`       | `latest`                                       | Image tag to run                                          |
| `HUB_PORT`      | `25802`                                        | Published Hub port                                        |
| `SERVER_PORT`   | `25811`                                        | Published Server port                                     |
| `CORS_ORIGINS`  | `["http://localhost:25803","http://localhost:25810"]` | Browser origins allowed to call Hub. A JSON array, not a comma list |
| `LOG_LEVEL`     | `info`                                         | `debug`, `info`, `warning` or `error`                     |

Set `CORS_ORIGINS` to the address people use to open Hub, for example `["https://loom.example.com"]`. An empty or malformed value stops Hub from starting.

### 4. Start the stack

Name the compose file explicitly. Plain `docker compose up` also loads `docker-compose.override.yml`, which is for local development and relaxes the security settings.

```bash
docker compose -f docker-compose.yml up -d
```

Compose pulls the images. If a tag is not published for your `VERSION`, build them locally instead:

```bash
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d
```

### 5. Check it

```bash
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs -f hub
```

Hub is healthy when `curl http://localhost:25802/api/v1/health` succeeds. The Server's health endpoint is `/api/health` on port 25811.

### 6. Claim the Owner account

Open Hub in a browser and register. **The first account registered becomes the Owner.** Do this immediately, before you publish Hub's address to anyone else. After that, only an Owner or Admin can create accounts.

## Connect a Server

Hub only sends work to Servers it knows about. There are two ways to add one.

### Let the Server register itself

A Server registers when these variables are set:

| Variable                  | Value                                                                      |
| ------------------------- | -------------------------------------------------------------------------- |
| `AUTH_MODE`               | `hub`                                                                      |
| `HUB_URL`                 | Where the Server reaches Hub, for example `http://hub:25802`               |
| `HUB_REGISTRATION_SECRET` | The contents of `server_registration_secret`                               |
| `HUB_SERVER_TOKEN`        | A long random string you choose. It identifies this Server to Hub          |
| `SERVER_NAME`             | Display name in Hub                                                        |
| `PUBLIC_ENDPOINT_URL`     | The address Hub **and Studio users** use to reach this Server              |

The Server then re-registers with Hub every 30 seconds, so it recovers if either side restarts.

:::note The sample compose files do not set everything
`docker-compose.yml` sets `AUTH_MODE`, `HUB_URL`, the registration secret and `SERVER_NAME` for the `server` service. It does not set `HUB_SERVER_TOKEN` or `PUBLIC_ENDPOINT_URL`. Without a token the Server does not register at all. Without a public endpoint it advertises `http://localhost:25811`, which neither Hub nor Studio can use. Add both variables to the `server` service, or register the Server by hand as described below.
:::

`PUBLIC_ENDPOINT_URL` matters because Hub hands that address to Studio. It must work from your users' machines, not only from inside the Docker network.

### Register a Server by hand

1. Sign in as Owner or Admin.
2. Open **Admin > Servers** and click **Register Server**.
3. Enter a name and the Server's endpoint URL, for example `https://loom-server.example.com`.
4. Save. Hub checks the Server's health immediately.

See [Server Management](./servers.md).

## Give the Server data

Hub mode restricts a Server to the folders that Hub grants to each user, through **filesystem connections**. The compose file mounts a volume read-only at `/app/data/files` inside the Server container. To use your own data, bind-mount a host directory there, then create a filesystem connection in **Admin > Connections** that points at `/app/data/files` and grant it through a grant group.

Servers that read database data use **database connections** instead. See [Hub Connections](./connections.md).

## Persistent data and backups

| Volume                             | Holds                            |
| ---------------------------------- | -------------------------------- |
| `sigilweaver_loom_postgres_data`   | The Hub database                 |
| `sigilweaver_loom_hub_workflows`   | Uploaded workflow files          |

Back up both, plus your `.secrets/` directory. Execution artifacts are written to `ARTIFACT_STORAGE_PATH` (default `./artifacts` inside the container). Because the Hub container's root filesystem is read-only, point that variable at a mounted volume if you want to keep artifacts. See [Hub Configuration](./hub-configuration.md).

## HTTPS with Caddy

The base file serves plain HTTP. For anything reachable from the internet, put TLS in front. `docker-compose.tls.yml` adds a Caddy reverse proxy that gets and renews certificates automatically. Live execution updates (server-sent events) pass through without buffering.

1. Point a DNS `A` or `AAAA` record, for example `loom.example.com`, at the host. Ports 80 and 443 must be reachable from the internet for the certificate challenge.
2. Add to `.env`:

   ```bash
   CADDY_DOMAIN=loom.example.com
   ACME_EMAIL=admin@example.com
   CORS_ORIGINS=["https://loom.example.com"]

   # Keep the app ports on loopback so only Caddy faces the internet
   HUB_PORT=127.0.0.1:25802
   SERVER_PORT=127.0.0.1:25811
   ```

   While testing, set `CADDY_ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory` to avoid rate limits.

3. Start both files:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
   ```

If Studio users connect to the Server directly through Hub-issued endpoints, that Server needs its own HTTPS address too. Caddy in this overlay fronts Hub only.

## Remote Servers over Tailscale

By default Hub reaches Servers over the Docker network. If a Server runs somewhere Hub cannot reach, such as a home lab or another network, join both to a [Tailscale](https://tailscale.com) tailnet. The stack in `docker/sidecar/` runs a Tailscale sidecar next to the Server and advertises its MagicDNS name through `PUBLIC_ENDPOINT_URL`.

```bash
cd docker/sidecar
cp .env.example .env    # set TS_AUTHKEY, TS_HOSTNAME, TS_TAILNET, HUB_URL, HUB_REGISTRATION_SECRET, HUB_SERVER_TOKEN
docker compose -f docker-compose.tailscale.yml up -d
```

Hub must be on the tailnet too. See `docker/sidecar/README.md` for the full walkthrough.

## Use an external PostgreSQL

1. Set the Hub's `DATABASE_URL` to `postgresql+asyncpg://user:password@host:5432/database`. The Hub image runs database migrations on start.
2. Remove the `postgres` service and the Hub's `depends_on` entry for it from your copy of the compose file.

## Add Server capacity

Run another Server container with its own `HUB_SERVER_TOKEN`, `SERVER_NAME` and `PUBLIC_ENDPOINT_URL`. Hub identifies a Server by its token, so containers that share a token count as one Server. Do not use `docker compose --scale` for this.

## Update

```bash
cd Loom
git pull
cd docker
docker compose -f docker-compose.yml pull     # or: build --pull
docker compose -f docker-compose.yml up -d
```

Hub applies database migrations when it starts. Back up the database before you upgrade a beta deployment.

## Troubleshooting

**Hub exits at startup.** Read `docker compose logs hub`. The usual cause is a missing or empty secret. Hub also stops if `CORS_ORIGINS` is not valid JSON, or if the database is unreachable after 30 attempts.

**A Server never appears in Admin > Servers.** Check that it has `HUB_SERVER_TOKEN` and `HUB_URL`, that `HUB_REGISTRATION_SECRET` matches Hub's `server_registration_secret`, and that the Server's log shows a successful registration.

**A Server shows Offline.** Hub cannot reach the endpoint it has on file. Open the endpoint's `/api/health` URL from the Hub container.

**Studio cannot run workflows.** The endpoint Hub gives to Studio must be reachable from the user's machine. Set `PUBLIC_ENDPOINT_URL` accordingly.

**Local development.** `docker compose -f hub/docker-compose.yml up --build` starts a throwaway stack with fixed, well-known secrets. Never use it for real data.
