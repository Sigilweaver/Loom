"""Service for persisting and retrieving execution artifacts.

The Server returns workflow outputs inline to the Hub. This service serializes
those outputs to CSV, writes them to the content-addressed
:class:`ArtifactStore`, and records a pointer + checksum row per output so they
can later be listed and streamed back (and integrity-verified) by the API.
"""

import csv
import io
import logging
import re
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ExecutionArtifact
from app.domain.artifacts.store import ArtifactStore, get_artifact_store

logger = logging.getLogger(__name__)

# Conservative filename component: keep it predictable and safe for a
# Content-Disposition header.
_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")

CSV_MEDIA_TYPE = "text/csv"


def _safe_name(value: str) -> str:
    """Reduce an arbitrary string to a safe filename component."""
    cleaned = _SAFE_NAME_RE.sub("_", value).strip("._")
    return cleaned or "output"


def _columns_from_schema(data_schema: Any) -> list[str]:
    """Extract ordered column names from a server ``data_schema`` payload."""
    if isinstance(data_schema, dict):
        columns = data_schema.get("columns")
        if isinstance(columns, list):
            names: list[str] = []
            for col in columns:
                if isinstance(col, dict) and "name" in col:
                    names.append(str(col["name"]))
            return names
    return []


def serialize_rows_to_csv(rows: list[dict[str, Any]], data_schema: Any) -> bytes:
    """Serialize output rows to deterministic UTF-8 CSV bytes.

    Column order is taken from the data schema when available (so an empty
    output still produces a header), otherwise from the first row.
    """
    columns = _columns_from_schema(data_schema)
    if not columns and rows:
        columns = list(rows[0].keys())

    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    if columns:
        writer.writerow(columns)
        for row in rows:
            writer.writerow(["" if row.get(c) is None else row.get(c) for c in columns])

    return buffer.getvalue().encode("utf-8")


class ArtifactService:
    """Persist and retrieve execution output artifacts."""

    def __init__(self, db: AsyncSession, store: ArtifactStore | None = None) -> None:
        self.db = db
        self.store = store or get_artifact_store()

    async def store_execution_outputs(
        self, execution_id: UUID, exec_result: dict[str, Any]
    ) -> list[ExecutionArtifact]:
        """Persist a successful execution's outputs as content-addressed artifacts.

        Args:
            execution_id: The execution these outputs belong to.
            exec_result: The Server's execute response, shaped as
                ``{"tool_id": str, "outputs": {socket_id: {data, data_schema,
                row_count}}}``.

        Returns:
            The persisted artifact rows (empty if there were no outputs).
        """
        outputs = exec_result.get("outputs") if isinstance(exec_result, dict) else None
        if not isinstance(outputs, dict) or not outputs:
            return []

        artifacts: list[ExecutionArtifact] = []
        for socket_id, payload in outputs.items():
            if not isinstance(payload, dict):
                continue
            rows = payload.get("data")
            rows = rows if isinstance(rows, list) else []
            row_count = payload.get("row_count")
            if not isinstance(row_count, int):
                row_count = len(rows)

            data = serialize_rows_to_csv(rows, payload.get("data_schema"))
            sha256, size_bytes = self.store.put_bytes(data)

            artifact = ExecutionArtifact(
                execution_id=execution_id,
                name=f"output-{_safe_name(str(socket_id))}.csv",
                media_type=CSV_MEDIA_TYPE,
                sha256=sha256,
                size_bytes=size_bytes,
                row_count=row_count,
            )
            self.db.add(artifact)
            artifacts.append(artifact)

        await self.db.commit()
        for artifact in artifacts:
            await self.db.refresh(artifact)
        return artifacts

    async def list_artifacts(self, execution_id: UUID) -> list[ExecutionArtifact]:
        """Return all artifacts for an execution, oldest first."""
        result = await self.db.execute(
            select(ExecutionArtifact)
            .where(ExecutionArtifact.execution_id == execution_id)
            .order_by(ExecutionArtifact.created_at, ExecutionArtifact.name)
        )
        return list(result.scalars().all())

    async def get_artifact(
        self, execution_id: UUID, artifact_id: UUID
    ) -> ExecutionArtifact | None:
        """Return a single artifact scoped to its execution, or None."""
        result = await self.db.execute(
            select(ExecutionArtifact).where(
                ExecutionArtifact.id == artifact_id,
                ExecutionArtifact.execution_id == execution_id,
            )
        )
        return result.scalar_one_or_none()
