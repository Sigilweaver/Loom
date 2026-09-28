#!/usr/bin/env python3
"""
Example script demonstrating workflow archival system usage.

This script shows how to:
1. Check archive status
2. List archived workflows
3. Retrieve archive details
4. Clean up old archives
"""

import os
from datetime import datetime, timedelta

import requests

# Server URL (adjust if needed)
BASE_URL = os.environ.get("SERVER_URL", "http://localhost:25811") + "/api"

# When the server runs with AUTH_MODE=ephemeral or static, requests need its
# session token. With AUTH_MODE=disabled no token is needed.
session = requests.Session()
if os.environ.get("SESSION_TOKEN"):
    session.headers["Authorization"] = f"Bearer {os.environ['SESSION_TOKEN']}"


def check_archive_status():
    """Check if archival is enabled and get configuration"""
    print("=" * 60)
    print("ARCHIVE STATUS")
    print("=" * 60)

    response = session.get(f"{BASE_URL}/archive/status")
    status = response.json()

    print(f"Enabled: {status['enabled']}")
    print(f"Archive Path: {status['archive_path']}")
    print(f"Retention Days: {status['retention_days']}")
    print()


def list_recent_archives(limit=10):
    """List the most recent archived workflows"""
    print("=" * 60)
    print(f"RECENT ARCHIVES (limit={limit})")
    print("=" * 60)

    response = session.get(f"{BASE_URL}/archive/list?limit={limit}")
    data = response.json()

    print(f"Total archives: {data['total']}")
    print()

    for i, archive in enumerate(data["archives"], 1):
        print(f"{i}. {archive['workflow_name']}")
        print(f"   Path: {archive['path']}")
        print(f"   Status: {archive['execution_status']}")
        if archive["execution_time"]:
            print(f"   Execution Time: {archive['execution_time']:.2f}ms")
        if archive["error"]:
            print(f"   Error: {archive['error']}")
        print(f"   Created: {archive['created']}")
        print()

    return data["archives"]


def list_archives_by_date(start_date=None, end_date=None):
    """List archives within a date range"""
    print("=" * 60)
    print("ARCHIVES BY DATE")
    print("=" * 60)

    params = {}
    if start_date:
        params["start_date"] = start_date.strftime("%Y-%m-%d")
    if end_date:
        params["end_date"] = end_date.strftime("%Y-%m-%d")

    response = session.get(f"{BASE_URL}/archive/list", params=params)
    data = response.json()

    print(f"Date range: {params.get('start_date', 'any')} to {params.get('end_date', 'any')}")
    print(f"Found: {data['total']} archives")
    print()

    return data["archives"]


def get_archive_details(archive_path):
    """Get complete details for a specific archive"""
    print("=" * 60)
    print(f"ARCHIVE DETAILS: {archive_path}")
    print("=" * 60)

    response = session.get(f"{BASE_URL}/archive/detail/{archive_path}")
    details = response.json()

    # Workflow info
    workflow = details.get("workflow", {})
    meta = workflow.get("meta", {})
    print(f"Workflow Name: {meta.get('name', 'N/A')}")
    print(f"Description: {meta.get('description', 'N/A')}")
    print(f"Author: {meta.get('author', 'N/A')}")
    print(f"Tools: {len(workflow.get('tools', []))}")
    print(f"Wires: {len(workflow.get('wires', []))}")
    print()

    # Execution log
    log = details.get("execution_log", {})
    print(f"Execution Status: {log.get('status', 'N/A')}")
    print(f"Timestamp: {log.get('timestamp', 'N/A')}")

    if log.get("execution_time_ms"):
        print(f"Total Execution Time: {log['execution_time_ms']:.2f}ms")

    if log.get("tool_executions"):
        print("\nTool Execution Timeline:")
        for tool_exec in log["tool_executions"]:
            print(
                f"  - {tool_exec['tool_id']} ({tool_exec['tool_type']}): "
                f"{tool_exec['execution_time_ms']:.2f}ms - {tool_exec['status']}"
            )

    if log.get("error"):
        print(f"\nError: {log['error']}")

    print()
    return details


def cleanup_old_archives(retention_days=30, dry_run=True):
    """Clean up archives older than retention period"""
    print("=" * 60)
    print(f"CLEANUP (retention_days={retention_days}, dry_run={dry_run})")
    print("=" * 60)

    if dry_run:
        # List what would be deleted
        cutoff = datetime.now() - timedelta(days=retention_days)
        response = session.get(
            f"{BASE_URL}/archive/list", params={"end_date": cutoff.strftime("%Y-%m-%d")}
        )
        data = response.json()
        print(f"Would delete {data['total']} archives older than {retention_days} days")

        for archive in data["archives"]:
            print(f"  - {archive['path']} ({archive['workflow_name']})")
    else:
        # Actually delete
        response = session.post(
            f"{BASE_URL}/archive/cleanup", json={"retention_days": retention_days}
        )
        result = response.json()
        print(f"Deleted {result['deleted_count']} archives")
        print(result["message"])

    print()


def main():
    """Run example usage scenarios"""
    print("\n" + "=" * 60)
    print("WORKFLOW ARCHIVAL SYSTEM - USAGE EXAMPLES")
    print("=" * 60 + "\n")

    try:
        # Check if archival is enabled
        check_archive_status()

        # List recent archives
        archives = list_recent_archives(limit=5)

        # List archives from last 7 days
        week_ago = datetime.now() - timedelta(days=7)
        list_archives_by_date(start_date=week_ago)

        # Get details for the most recent archive (if any)
        if archives:
            get_archive_details(archives[0]["path"])

        # Dry run cleanup (show what would be deleted)
        cleanup_old_archives(retention_days=30, dry_run=True)

        print("=" * 60)
        print("Example completed successfully!")
        print("=" * 60)

    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to the server.")
        print(f"Make sure it is running at {BASE_URL.removesuffix('/api')}")
    except Exception as e:
        print(f"ERROR: {e}")


if __name__ == "__main__":
    main()
