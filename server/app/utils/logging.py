"""Structured logging setup for execution tracking"""

import logging
import sys
import time
from pathlib import Path
from typing import Any, Literal


def setup_logging(log_level: str = "INFO", log_file: Path | None = None) -> None:
    """
    Configure logging for the application.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Optional file to write logs to
    """
    # Create formatter
    formatter = logging.Formatter(
        fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # File handler (if specified)
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)


class ExecutionLogger:
    """
    Context manager for tracking execution metrics and logging.

    Captures timing, errors, and execution metadata.
    """

    def __init__(self, logger: logging.Logger, operation: str):
        """
        Initialize execution logger.

        Args:
            logger: Logger instance to use
            operation: Description of operation being tracked
        """
        self.logger = logger
        self.operation = operation
        self.start_time: float | None = None
        self.end_time: float | None = None
        self.error: str | None = None
        self.metadata: dict[str, Any] = {}

    def __enter__(self) -> "ExecutionLogger":
        """Start timing"""
        self.start_time = time.time()
        self.logger.info(f"Starting: {self.operation}")
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: Any,
    ) -> Literal[False]:
        """End timing and log results"""
        self.end_time = time.time()
        if self.start_time is None:
            self.start_time = self.end_time
        duration_ms = (self.end_time - self.start_time) * 1000

        if exc_type is not None:
            self.error = str(exc_val)
            self.logger.error(f"Failed: {self.operation} ({duration_ms:.2f}ms) - {self.error}")
        else:
            self.logger.info(f"Completed: {self.operation} ({duration_ms:.2f}ms)")

        # Don't suppress exceptions
        return False

    def add_metadata(self, key: str, value: Any) -> None:
        """Add metadata to execution log"""
        self.metadata[key] = value

    def get_log_data(self) -> dict[str, Any]:
        """Get structured log data"""
        duration_ms = None
        if self.start_time and self.end_time:
            duration_ms = (self.end_time - self.start_time) * 1000

        return {
            "operation": self.operation,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_ms": duration_ms,
            "error": self.error,
            "metadata": self.metadata,
        }
