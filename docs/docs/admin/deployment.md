---
sidebar_position: 1
description: Deploy Sigilweaver Server and Hub using Docker
---

# Deployment Guide

This guide covers how to deploy the Sigilweaver server and hub components using Docker. This is suitable for both self-hosted environments and cloud deployments.

## Prerequisites

- [Docker Engine](https://docs.docker.com/engine/install/) (v24.0+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.20+)
- OpenSSL (for generating secrets)

## Quick Start (Production)

To get Sigilweaver up and running quickly, follow these steps:

### 1. Clone the Repository or Download Docker Files

You'll need the `docker-compose.yml` and related configuration files.

```bash
git clone https://github.com/Sigilweaver/Sigilweaver.git
cd sigilweaver/docker
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` to set your domain and other configuration options.

### 3. Generate Secrets

Sigilweaver requires several secret keys for secure operation. Run the following commands to generate them:

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
