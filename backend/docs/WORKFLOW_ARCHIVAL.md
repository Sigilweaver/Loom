# Workflow Archival System

## Overview

The workflow archival system automatically saves copies of all workflows sent to the backend server along with detailed execution logs. This provides a complete audit trail of workflow executions including timing, results, and any errors that occurred.

## Features

- **Automatic Archival**: Every workflow execution is automatically archived (when enabled)
- **Structured Storage**: Archives organized by date with readable directory names
- **Execution Logs**: Detailed logs including:
  - Execution status (started, completed, failed)
  - Timing information (total execution time, per-tool timing)
  - Tool execution order
  - Error details if execution failed
  - Result summaries
- **API Access**: REST API to list, retrieve, and manage archived workflows
- **Configurable Retention**: Automatic cleanup of old archives based on retention policy

## Configuration

Configure the archive system in `backend/app/config.py` or via environment variables:

```bash
# Enable/disable archival (default: true)
ARCHIVE_ENABLED=true

# Archive storage location (default: ./workflow_archives)
ARCHIVE_PATH=/path/to/archives

# Retention period in days; 0 = keep forever (default: 30)
ARCHIVE_RETENTION_DAYS=30
```

## Directory Structure

Archives are organized in a date-based hierarchy:

```
workflow_archives/
├── 2025-11-26/
│   ├── 14-30-00_DataCleaning/
│   │   ├── workflow.json          # Original workflow definition
│   │   └── execution_log.json     # Execution metadata and logs
│   ├── 14-35-12_ReportGeneration/
│   │   ├── workflow.json
│   │   └── execution_log.json
│   └── ...
├── 2025-11-27/
│   └── ...
```

### workflow.json

Contains the complete workflow definition including:
- All tools and their configurations
- Wire connections
- Workflow metadata (name, description)

### execution_log.json

Contains execution details:
```json
{
  "timestamp": "2025-11-26 14:30:00",
  "status": "completed",
  "target_tool_id": "output1",
  "execution_time_ms": 1234.56,
  "tool_count": 5,
  "execution_order": ["input1", "filter1", "transform1", "join1", "output1"],
  "tool_executions": [
    {
      "tool_id": "input1",
      "tool_type": "Input",
      "execution_time_ms": 123.45,
      "status": "success"
    },
    ...
  ],
  "result_summary": {
    "tool_id": "output1",
    "output_count": 1
  }
}
```

## API Endpoints

### List Archived Workflows

```http
GET /api/archive/list?limit=50&start_date=2025-11-01&end_date=2025-11-30
```

**Query Parameters:**
- `limit` (optional): Maximum number of results to return
- `start_date` (optional): Filter archives from this date (YYYY-MM-DD)
- `end_date` (optional): Filter archives until this date (YYYY-MM-DD)

**Response:**
```json
{
  "archives": [
    {
      "path": "2025-11-26/14-30-00_DataCleaning",
      "created": "2025-11-26T14:30:00",
      "workflow_name": "Data Cleaning Pipeline",
      "workflow_description": "Cleans and validates input data",
      "tool_count": 5,
      "execution_status": "completed",
      "execution_time": 1234.56,
      "execution_timestamp": "2025-11-26 14:30:00",
      "target_tool_id": "output1",
      "error": null
    },
    ...
  ],
  "total": 42
}
```

### Get Archive Details

```http
GET /api/archive/detail/{archive_path}
```

**Example:**
```http
GET /api/archive/detail/2025-11-26/14-30-00_DataCleaning
```

**Response:**
```json
{
  "path": "2025-11-26/14-30-00_DataCleaning",
  "workflow": {
    "tools": [...],
    "wires": [...],
    "metadata": {...}
  },
  "execution_log": {
    "timestamp": "2025-11-26 14:30:00",
    "status": "completed",
    ...
  }
}
```

### Get Archive Status

```http
GET /api/archive/status
```

**Response:**
```json
{
  "enabled": true,
  "archive_path": "./workflow_archives",
  "retention_days": 30
}
```

### Cleanup Old Archives

```http
POST /api/archive/cleanup
Content-Type: application/json

{
  "retention_days": 30
}
```

**Response:**
```json
{
  "deleted_count": 15,
  "message": "Deleted 15 archives older than 30 days"
}
```

## Usage Examples

### Python Client

```python
import requests

# List recent archives
response = requests.get("http://localhost:8000/api/archive/list?limit=10")
archives = response.json()["archives"]

for archive in archives:
    print(f"{archive['workflow_name']}: {archive['execution_status']}")

# Get detailed archive
archive_path = archives[0]["path"]
response = requests.get(f"http://localhost:8000/api/archive/detail/{archive_path}")
details = response.json()

workflow = details["workflow"]
log = details["execution_log"]
print(f"Execution time: {log['execution_time_ms']}ms")
```

### JavaScript/TypeScript Frontend

```typescript
// List archives
const listArchives = async () => {
  const response = await fetch('/api/archive/list?limit=50');
  const data = await response.json();
  return data.archives;
};

// Get archive details
const getArchiveDetails = async (archivePath: string) => {
  const response = await fetch(`/api/archive/detail/${archivePath}`);
  const details = await response.json();
  return details;
};

// Check archive status
const getArchiveStatus = async () => {
  const response = await fetch('/api/archive/status');
  const status = await response.json();
  return status;
};
```

## How Archival Works

1. **Workflow Submission**: When a workflow is submitted for execution via `/api/workflow/execute` or `/api/workflow/tool/execute`

2. **Archive Creation**: Before execution starts, the `WorkflowExecutor` creates an archive directory and saves the workflow definition

3. **Execution Tracking**: As tools execute, timing and status information is collected

4. **Log Saving**: When execution completes (or fails), the complete execution log is saved to the archive

5. **Archive Structure**: Archives are organized by date and include workflow name in the directory for easy browsing

## Error Handling

If archival fails for any reason:
- The execution continues normally (archival failures don't stop workflow execution)
- Errors are logged to the application log
- The workflow execution result is returned as usual

This ensures that archive failures don't impact the core functionality.

## Disabling Archival

To disable archival entirely:

```bash
# Via environment variable
export ARCHIVE_ENABLED=false

# Or in config.py
archive_enabled: bool = False
```

When disabled, the archive API endpoints return a 503 status with an appropriate message.

## Retention and Cleanup

Archives can be automatically cleaned up based on age:

1. **Manual Cleanup**: Use the `/api/archive/cleanup` endpoint
2. **Retention Policy**: Set `ARCHIVE_RETENTION_DAYS` in configuration
3. **Scheduled Cleanup**: You can schedule periodic cleanup using cron or similar:

```bash
# Example: Daily cleanup at 2 AM
0 2 * * * curl -X POST http://localhost:8000/api/archive/cleanup \
  -H "Content-Type: application/json" \
  -d '{"retention_days": 30}'
```

## Storage Considerations

- Each archive typically uses a few KB of storage (workflow JSON + execution log)
- For high-volume deployments, monitor archive directory size
- Use the retention policy to automatically manage storage
- Consider archiving to external storage for long-term retention

## Security Considerations

- Archive files contain complete workflow definitions including file paths and configurations
- Ensure the archive directory has appropriate file system permissions
- Consider encrypting archives if they contain sensitive information
- Implement access controls for the archive API endpoints if needed

## Troubleshooting

### Archives Not Being Created

1. Check that `ARCHIVE_ENABLED=true`
2. Verify write permissions for `ARCHIVE_PATH`
3. Check application logs for error messages
4. Verify the backend is properly configured

### Cannot Access Archives via API

1. Check that archiving is enabled (`/api/archive/status`)
2. Verify the archive path exists and is readable
3. Check for errors in the backend logs
4. Ensure the archive path is correct in the configuration

### Disk Space Issues

1. Check archive directory size: `du -sh ./workflow_archives`
2. Run cleanup: `POST /api/archive/cleanup` with appropriate retention
3. Consider moving old archives to cold storage
4. Reduce retention period in configuration

## Future Enhancements

Potential improvements for the archive system:

- [ ] Archive compression to save disk space
- [ ] Export archives to external storage (S3, etc.)
- [ ] Search archives by workflow name, tool types, or execution status
- [ ] Compare archived workflow versions
- [ ] Replay archived workflows
- [ ] Archive visualization and analytics
