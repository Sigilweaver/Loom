"""Content-addressed storage for execution artifacts.

Artifacts (workflow outputs) are stored on disk keyed by the SHA-256 hash of
their contents. Identical outputs are therefore stored exactly once (natural
deduplication) and every read can be checksum-verified against its address,
making tampering or corruption detectable.

The on-disk layout shards by the first byte of the digest to avoid very large
directories:

    <root>/<digest[:2]>/<digest[2:]>
"""

import hashlib
import logging
import os
import re
import tempfile
from collections.abc import Iterator
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

# SHA-256 digests are exactly 64 lowercase hex characters. Validating against
# this pattern before touching the filesystem prevents path traversal via a
# crafted "digest".
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")

# Streaming chunk size for hashing and reads (64 KiB).
CHUNK_SIZE = 64 * 1024


class ArtifactStoreError(Exception):
    """Base exception for artifact store errors."""


class ArtifactNotFoundError(ArtifactStoreError):
    """Raised when an artifact blob does not exist in the store."""


class ArtifactCorruptedError(ArtifactStoreError):
    """Raised when a stored blob's contents no longer match its address."""


class ArtifactStore:
    """Filesystem-backed, content-addressed blob store."""

    def __init__(self, root: str | None = None) -> None:
        """Initialize the store.

        Args:
            root: Directory for storing artifact blobs. Falls back to
                ``settings.artifact_storage_path`` when not provided.
        """
        self.root = Path(
            root or str(getattr(settings, "artifact_storage_path", "./artifacts"))
        )
        self.root.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def compute_sha256(data: bytes) -> str:
        """Return the hex-encoded SHA-256 digest of ``data``."""
        return hashlib.sha256(data).hexdigest()

    def _normalize(self, sha256: str) -> str:
        """Validate and normalize a digest, guarding against path traversal."""
        digest = sha256.lower()
        if not _SHA256_RE.match(digest):
            raise ArtifactStoreError(f"Invalid SHA-256 digest: {sha256!r}")
        return digest

    def path_for(self, sha256: str) -> Path:
        """Return the on-disk path for a digest (does not check existence)."""
        digest = self._normalize(sha256)
        return self.root / digest[:2] / digest[2:]

    def put_bytes(self, data: bytes) -> tuple[str, int]:
        """Store ``data`` and return its ``(sha256, size_bytes)``.

        Writing is atomic (temp file + rename) and idempotent: storing
        identical bytes again is a no-op.
        """
        sha256 = self.compute_sha256(data)
        size = len(data)
        path = self.path_for(sha256)
        if path.exists():
            return sha256, size

        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-")
        try:
            with os.fdopen(fd, "wb") as tmp_file:
                tmp_file.write(data)
                tmp_file.flush()
                os.fsync(tmp_file.fileno())
            os.replace(tmp_name, path)
        except BaseException:
            try:
                os.unlink(tmp_name)
            except OSError:
                pass
            raise
        return sha256, size

    def exists(self, sha256: str) -> bool:
        """Return whether a blob with the given digest is stored."""
        return self.path_for(sha256).exists()

    def size(self, sha256: str) -> int:
        """Return the size in bytes of a stored blob."""
        path = self.path_for(sha256)
        if not path.exists():
            raise ArtifactNotFoundError(sha256)
        return path.stat().st_size

    def verify(self, sha256: str) -> bool:
        """Re-hash the stored blob and confirm it matches its address."""
        digest = self._normalize(sha256)
        path = self.path_for(digest)
        if not path.exists():
            raise ArtifactNotFoundError(sha256)
        hasher = hashlib.sha256()
        with path.open("rb") as blob:
            for chunk in iter(lambda: blob.read(CHUNK_SIZE), b""):
                hasher.update(chunk)
        return hasher.hexdigest() == digest

    def open_stream(self, sha256: str, *, verify: bool = True) -> Iterator[bytes]:
        """Yield the blob's bytes in chunks.

        When ``verify`` is true the contents are checksum-verified before any
        bytes are yielded, so a corrupted blob fails fast instead of streaming
        bad data to the client.
        """
        path = self.path_for(sha256)
        if not path.exists():
            raise ArtifactNotFoundError(sha256)
        if verify and not self.verify(sha256):
            raise ArtifactCorruptedError(sha256)

        def _iter() -> Iterator[bytes]:
            with path.open("rb") as blob:
                for chunk in iter(lambda: blob.read(CHUNK_SIZE), b""):
                    yield chunk

        return _iter()


def get_artifact_store() -> ArtifactStore:
    """Return an :class:`ArtifactStore` using the configured storage path."""
    return ArtifactStore()
