# Backend Examples

This directory contains example scripts demonstrating how to use the SigilWeaver backend API.

## Archive Usage Example

`archive_usage.py` - Demonstrates the workflow archival system API.

### Requirements

```bash
pip install requests
```

### Usage

1. Start the backend server:
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

2. In another terminal, run the example:
```bash
cd backend
python examples/archive_usage.py
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
