"""Workflow archive system for storing executed workflows and logs"""

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from app.domain.models.workflow import Workflow

logger = logging.getLogger(__name__)


class WorkflowArchive:
    """
    Manages archival of executed workflows and their execution logs.

    Archives are stored as JSON files with the following structure:
    - workflow.json: Original workflow definition
    - execution_log.json: Execution metadata, timing, errors, results

    Directory structure:
    archive_root/
        YYYY-MM-DD/
            HH-MM-SS_{workflow_id}/
                workflow.json
                execution_log.json
    """

    def __init__(self, archive_path: str | Path):
        """
        Initialize the archive manager.

        Args:
            archive_path: Root directory for workflow archives
        """
        self.archive_root = Path(archive_path)
        self.archive_root.mkdir(parents=True, exist_ok=True)
        logger.info(f"WorkflowArchive initialized at: {self.archive_root}")

    def create_archive(
        self,
        workflow: Workflow,
        execution_id: str | None = None,
    ) -> Path:
        """
        Create a new archive directory for a workflow execution.

        Args:
            workflow: Workflow being executed
            execution_id: Optional custom execution ID (defaults to timestamp)

        Returns:
            Path to the created archive directory
        """
        now = datetime.now()
        date_dir = now.strftime("%Y-%m-%d")

        if execution_id:
            time_stamp = execution_id
        else:
            time_stamp = now.strftime("%H-%M-%S")
            if workflow.meta and workflow.meta.name:
                # Sanitize workflow name for filesystem
                safe_name = "".join(
                    c if c.isalnum() or c in "-_" else "_" for c in workflow.meta.name
                )
                time_stamp = f"{time_stamp}_{safe_name[:50]}"  # Limit length

        # Ensure unique directory name by adding counter if needed
        base_archive_dir = self.archive_root / date_dir / time_stamp
        archive_dir = base_archive_dir
        counter = 1
        while archive_dir.exists():
            archive_dir = self.archive_root / date_dir / f"{time_stamp}_{counter}"
            counter += 1

        archive_dir.mkdir(parents=True, exist_ok=True)

        # Save workflow definition
        workflow_file = archive_dir / "workflow.json"
        with open(workflow_file, "w") as f:
            json.dump(workflow.model_dump(), f, indent=2, default=str)

        logger.info(f"Created workflow archive: {archive_dir}")
        return archive_dir

    def save_execution_log(
        self,
        archive_dir: Path,
        log_data: dict[str, Any],
    ) -> None:
        """
        Save execution log to archive.

        Args:
            archive_dir: Archive directory path
            log_data: Execution log data including timing, results, errors
        """
        log_file = archive_dir / "execution_log.json"

        # Add timestamp if not present
        if "timestamp" not in log_data:
            log_data["timestamp"] = datetime.now().isoformat()

        with open(log_file, "w") as f:
            json.dump(log_data, f, indent=2, default=str)

        logger.info(f"Saved execution log to: {log_file}")

    def list_archives(
        self,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """
        List archived workflows with optional date filtering.

        Args:
            start_date: Optional start date filter
            end_date: Optional end date filter
            limit: Optional maximum number of results

        Returns:
            List of archive metadata dictionaries
        """
        archives = []

        # Iterate through date directories
        for date_dir in sorted(self.archive_root.iterdir(), reverse=True):
            if not date_dir.is_dir():
                continue

            # Parse date from directory name
            try:
                dir_date = datetime.strptime(date_dir.name, "%Y-%m-%d")
            except ValueError:
                logger.warning(f"Skipping invalid date directory: {date_dir.name}")
                continue

            # Apply date filters
            if start_date and dir_date < start_date.replace(hour=0, minute=0, second=0):
                continue
            if end_date and dir_date > end_date.replace(hour=23, minute=59, second=59):
                continue

            # Iterate through execution directories
            for exec_dir in sorted(date_dir.iterdir(), reverse=True):
                if not exec_dir.is_dir():
                    continue

                try:
                    archive_info = self._get_archive_info(exec_dir)
                    archives.append(archive_info)

                    if limit and len(archives) >= limit:
                        return archives
                except Exception as e:
                    logger.error(f"Error reading archive {exec_dir}: {e}")
                    continue

        return archives

    def get_archive(self, archive_path: str) -> dict[str, Any]:
        """
        Get complete archive data including workflow and execution log.

        Args:
            archive_path: Relative path to archive (e.g., "2025-11-26/14-30-00_MyWorkflow")

        Returns:
            Dictionary with workflow and execution_log
        """
        full_path = self.archive_root / archive_path

        if not full_path.exists() or not full_path.is_dir():
            raise ValueError(f"Archive not found: {archive_path}")

        result = {"path": archive_path}

        # Load workflow
        workflow_file = full_path / "workflow.json"
        if workflow_file.exists():
            with open(workflow_file, "r") as f:
                result["workflow"] = json.load(f)

        # Load execution log
        log_file = full_path / "execution_log.json"
        if log_file.exists():
            with open(log_file, "r") as f:
                result["execution_log"] = json.load(f)

        return result

    def _get_archive_info(self, archive_dir: Path) -> dict[str, Any]:
        """Extract summary information from an archive directory"""
        info: dict[str, Any] = {
            "path": str(archive_dir.relative_to(self.archive_root)),
            "created": datetime.fromtimestamp(archive_dir.stat().st_ctime).isoformat(),
        }

        # Extract workflow metadata
        workflow_file = archive_dir / "workflow.json"
        if workflow_file.exists():
            with open(workflow_file, "r") as f:
                workflow_data = json.load(f)
                if "meta" in workflow_data:
                    info["workflow_name"] = workflow_data["meta"].get("name", "Unnamed")
                    info["workflow_description"] = workflow_data["meta"].get("description", "")
                info["tool_count"] = len(workflow_data.get("tools", []))

        # Extract execution summary
        log_file = archive_dir / "execution_log.json"
        if log_file.exists():
            with open(log_file, "r") as f:
                log_data = json.load(f)
                info["execution_status"] = log_data.get("status", "unknown")
                info["execution_time"] = log_data.get("execution_time_ms")
                info["target_tool_id"] = log_data.get("target_tool_id")
                info["error"] = log_data.get("error")
                if "timestamp" in log_data:
                    info["execution_timestamp"] = log_data["timestamp"]

        return info

    def cleanup_old_archives(self, retention_days: int) -> int:
        """
        Remove archives older than specified retention period.

        Args:
            retention_days: Number of days to retain archives

        Returns:
            Number of archives deleted
        """
        if retention_days <= 0:
            logger.warning("Invalid retention_days, skipping cleanup")
            return 0

        cutoff_date = datetime.now() - timedelta(days=retention_days)
        cutoff_date = cutoff_date.replace(hour=0, minute=0, second=0)

        deleted_count = 0

        for date_dir in self.archive_root.iterdir():
            if not date_dir.is_dir():
                continue

            try:
                dir_date = datetime.strptime(date_dir.name, "%Y-%m-%d")
                if dir_date < cutoff_date:
                    # Delete entire date directory
                    import shutil

                    shutil.rmtree(date_dir)
                    deleted_count += sum(1 for _ in date_dir.iterdir() if _.is_dir())
                    logger.info(f"Deleted old archive directory: {date_dir}")
            except ValueError:
                logger.warning(f"Skipping invalid date directory: {date_dir.name}")
                continue
            except Exception as e:
                logger.error(f"Error deleting archive {date_dir}: {e}")
                continue

        logger.info(f"Cleanup completed: {deleted_count} archives deleted")
        return deleted_count
