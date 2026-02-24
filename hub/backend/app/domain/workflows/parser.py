"""Workflow file parser.

Parses .swwf workflow files and extracts metadata.
"""

import json
import logging
from typing import Any

from app.domain.workflows.models import ParsedWorkflow, WorkflowMeta

logger = logging.getLogger(__name__)


class ParseError(Exception):
    """Raised when workflow parsing fails."""

    pass


class WorkflowParser:
    """Parser for .swwf workflow files.

    Validates structure and extracts metadata from workflow JSON.
    """

    REQUIRED_FIELDS = {"version", "meta", "tools", "wires"}
    REQUIRED_META_FIELDS = {"name", "workflowId"}

    def parse(self, content: bytes) -> ParsedWorkflow:
        """Parse workflow file content.

        Args:
            content: Raw bytes from .swwf file.

        Returns:
            ParsedWorkflow with validated structure.

        Raises:
            ParseError: If content is invalid.
        """
        # Decode UTF-8
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError as e:
            raise ParseError(f"File content is not valid UTF-8: {e}")

        # Parse JSON
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise ParseError(f"File content is not valid JSON: {e}")

        # Validate structure
        if not isinstance(data, dict):
            raise ParseError("Workflow must be a JSON object")

        # Check required top-level fields
        for field in self.REQUIRED_FIELDS:
            if field not in data:
                raise ParseError(f"Missing required field: {field}")

        # Validate meta
        meta = data["meta"]
        if not isinstance(meta, dict):
            raise ParseError("Field 'meta' must be an object")

        for field in self.REQUIRED_META_FIELDS:
            if field not in meta:
                raise ParseError(f"Invalid meta field: missing '{field}'")

        # Validate tools and wires are arrays
        if not isinstance(data["tools"], list):
            raise ParseError("Field 'tools' must be an array")
        if not isinstance(data["wires"], list):
            raise ParseError("Field 'wires' must be an array")

        # Build WorkflowMeta with defaults
        workflow_meta = WorkflowMeta(
            name=meta.get("name", ""),
            description=meta.get("description", ""),
            author=meta.get("author", ""),
            workflowId=meta.get("workflowId", ""),
            created=meta.get("created", ""),
        )

        return ParsedWorkflow(
            version=data["version"],
            meta=workflow_meta,
            tools=data["tools"],
            wires=data["wires"],
        )

    def extract_metadata(self, content: bytes) -> WorkflowMeta:
        """Extract just metadata from workflow file.

        Args:
            content: Raw bytes from .swwf file.

        Returns:
            WorkflowMeta with extracted fields.

        Raises:
            ParseError: If content is invalid.
        """
        parsed = self.parse(content)
        return parsed.meta

    def to_dict(self, content: bytes) -> dict[str, Any]:
        """Parse to raw dictionary.

        Args:
            content: Raw bytes from .swwf file.

        Returns:
            Raw workflow dictionary.

        Raises:
            ParseError: If content is invalid.
        """
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError as e:
            raise ParseError(f"File content is not valid UTF-8: {e}")

        try:
            data: dict[str, Any] = json.loads(text)
            return data
        except json.JSONDecodeError as e:
            raise ParseError(f"File content is not valid JSON: {e}")
