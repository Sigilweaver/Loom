# Server Examples

This directory contains example scripts demonstrating how to use the Sigilweaver Server API.

## Archive Usage Example

`archive_usage.py` - Demonstrates the workflow archival system API.

### Requirements

The script needs `requests`, which is not a dependency of the server. The command
below pulls it in for the run without changing the project.

### Usage

1. Start the server (from the `server/` directory). Archiving is on by
   default (`ARCHIVE_ENABLED=true`). Either disable auth for local use or note the
   session token the server prints at startup:
```bash
cd server
AUTH_MODE=disabled ARCHIVE_ENABLED=true PORT=25811 ./run.sh
```

2. In another terminal, run the example (set `SESSION_TOKEN` if auth is enabled,
   and `SERVER_URL` if the server is not on `http://localhost:25811`):
```bash
cd server
uv run --with requests python examples/archive_usage.py
```

### What it demonstrates

- Checking archive system status
- Listing archived workflows
- Filtering archives by date
- Retrieving detailed archive information
- Cleanup operations (dry run mode)

### Example Output

```
==============================================================
WORKFLOW ARCHIVAL SYSTEM - USAGE EXAMPLES
==============================================================

==============================================================
ARCHIVE STATUS
==============================================================
Enabled: True
Archive Path: ./workflow_archives
Retention Days: 30

==============================================================
RECENT ARCHIVES (limit=5)
==============================================================
Total archives: 3

1. Data Cleaning Pipeline
   Path: 2025-11-26/14-30-00_DataCleaning
   Status: completed
   Execution Time: 1234.56ms
   Created: 2025-11-26T14:30:00

...
```

## Adding More Examples

To add new examples:

1. Create a new Python script in this directory
2. Add documentation to this README
3. Keep examples focused on specific use cases
4. Include error handling for better learning experience
