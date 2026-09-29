---
sidebar_position: 4
title: Hub Configuration
---

# Hub Configuration

Reference for Hub's environment variables. Names are case-insensitive. Set them in the environment or in a `.env` file in the backend's working directory. List values must be JSON arrays.

## Required secrets

Hub refuses to start if any of these is empty:

| Variable                     | Meaning                                                                     |
| ---------------------------- | --------------------------------------------------------------------------- |
| `SESSION_SECRET`             | Signs Hub sessions. Use at least 32 random bytes.                           |
| `SECRET_KEY`                 | Legacy signing key. Still required. Use at least 32 random bytes.           |
| `CONNECTION_ENCRYPTION_KEY`  | Fernet key that encrypts stored connection credentials                      |
| `SERVER_REGISTRATION_SECRET` | Shared secret that Servers present to register. Must match each Server's `HUB_REGISTRATION_SECRET`. |

Generate them with OpenSSL:

```bash
openssl rand -hex 32                                    # SESSION_SECRET, SECRET_KEY, SERVER_REGISTRATION_SECRET
openssl rand -base64 32 | tr '+/' '-_' | tr -d '\n'     # CONNECTION_ENCRYPTION_KEY
```

The Docker image also rejects the literal value `CHANGE_ME_IN_PRODUCTION` for the first three, and the entrypoint checks that `DATABASE_URL` is set.

### Docker secrets

In Docker, every secret can come from a file. Set `<NAME>_FILE` to a path and the entrypoint reads the value from it:

`SESSION_SECRET_FILE`, `SECRET_KEY_FILE`, `CONNECTION_ENCRYPTION_KEY_FILE`, `SERVER_REGISTRATION_SECRET_FILE`.

For the database password, set `DATABASE_URL_TEMPLATE` to a URL that contains `__PASSWORD__`, and `DATABASE_PASSWORD_FILE` to the file that holds the password. The entrypoint URL-encodes the password and builds `DATABASE_URL`. This keeps the password out of `docker inspect`.

### Development shortcut

`ALLOW_INSECURE_DEFAULTS=true` makes Hub generate random values for any missing secret at startup and log a warning. Sessions and tokens do not survive a restart. Never use it in production.

## Core

| Variable            | Default       | Meaning                                                             |
| ------------------- | ------------- | ------------------------------------------------------------------- |
| `HOST`              | `0.0.0.0`     | Bind address                                                        |
| `PORT`              | `25802`       | HTTP port                                                           |
| `RELOAD`            | `false`       | Auto-reload (development only)                                      |
| `LOG_LEVEL`         | `info`        | `debug`, `info`, `warning` or `error`                               |
| `LOG_FORMAT`        | `text`        | `text` or `json`                                                    |
| `STATIC_FILES_PATH` | empty         | Directory of the built web app. The Docker image sets `/app/static`. When empty, Hub serves only the API. |
| `CORS_ORIGINS`      | `["http://localhost:25803","http://localhost:25810"]` | Browser origins allowed to call the API |

`ENVIRONMENT` (`development` or `production`) exists as a setting, but nothing in Hub reads it today.

## Database

| Variable       | Default                                                                                   | Meaning                     |
| -------------- | ----------------------------------------------------------------------------------------- | --------------------------- |
| `DATABASE_URL` | `postgresql+asyncpg://sigilweaver_loom:sigilweaver_loom@localhost:25801/sigilweaver_loom_hub` | PostgreSQL connection URL. Must use the `postgresql+asyncpg` driver. |

The Docker image applies database migrations each time it starts.

## Sessions and tokens

| Variable                            | Default  | Meaning                                                                        |
| ----------------------------------- | -------- | ------------------------------------------------------------------------------ |
| `SESSION_LIFETIME_HOURS`            | `24`     | How long a login lasts                                                         |
| `SESSION_CLEANUP_INTERVAL_SECONDS`  | `3600`   | How often expired sessions are removed                                         |
| `SESSION_CLEANUP_BATCH_SIZE`        | `1000`   | Most sessions removed per pass                                                 |
| `SERVER_TOKEN_TTL_SECONDS`          | `300`    | Lifetime of the token that lets Studio call a Server                           |
| `TOKEN_STORE_BACKEND`               | `memory` | Where issued Server tokens are kept: `memory` or `postgres`                    |

With `memory`, tokens are lost when Hub restarts and cannot be shared between Hub processes. Use `postgres` if you ever run more than one Hub process. See [Hub Open Beta](./hub-beta.md).

## Servers

| Variable                        | Default | Meaning                                                                    |
| ------------------------------- | ------- | -------------------------------------------------------------------------- |
| `SERVER_POLL_INTERVAL_SECONDS`  | `30`    | How often Hub checks each Server's health                                  |
| `SERVER_TIMEOUT_SECONDS`        | `10`    | Timeout for a health check                                                 |
| `SERVER_OFFLINE_THRESHOLD`      | `3`     | Consecutive failed checks before a Server is marked Offline                |
| `SERVER_BACKOFF_MAX_SECONDS`    | `60`    | Upper limit on the retry delay for a failing Server                        |

## Storage

| Variable                | Default         | Meaning                                                    |
| ----------------------- | --------------- | ---------------------------------------------------------- |
| `WORKFLOW_STORAGE_PATH` | `./workflows`   | Where uploaded workflow files and revisions are stored     |
| `ARTIFACT_STORAGE_PATH` | `./artifacts`   | Where execution outputs are stored                         |

Both paths are relative to Hub's working directory unless you give an absolute path. In Docker, mount a volume for each one that you want to keep. The provided compose file mounts only the workflows directory.

## Rate limiting

Off by default. When on, Hub returns `429` with a `Retry-After` header once a limit is exceeded.

| Variable                            | Default          | Applies to                                 |
| ----------------------------------- | ---------------- | ------------------------------------------ |
| `RATE_LIMIT_ENABLED`                | `false`          | Master switch                              |
| `RATE_LIMIT_LOGIN`                  | `10/15 minutes`  | Login attempts                             |
| `RATE_LIMIT_REGISTER`               | `5/hour`         | Registration                               |
| `RATE_LIMIT_SERVER_REGISTRATION`    | `20/hour`        | Server registration                        |
| `RATE_LIMIT_CAPABILITY_TOKEN`       | `60/minute`      | Requests for Server tokens                 |
| `RATE_LIMIT_INTERNAL_AUTHORIZE`     | `600/minute`     | Servers asking Hub to authorize a request  |

## Legacy settings

`ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `JWT_PRIVATE_KEY` and `JWT_ISSUER` are still defined but are not used by the current authentication flow. You do not need to set them.
