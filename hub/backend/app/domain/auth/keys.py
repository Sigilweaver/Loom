"""RSA key management for signing server tokens.

This module manages the RSA keypair used to sign JWTs (server tokens) that
authorize workflow execution. The private key is used by Hub to sign tokens,
and the public key can be exported as JWKS for servers to verify signatures.

In development, an ephemeral key is generated at startup. In production,
a persistent key should be provided via the JWT_PRIVATE_KEY environment variable.
"""

import base64
import logging
from typing import Any

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey

logger = logging.getLogger(__name__)


class KeyManager:
    """Manages RSA keypair for signing server tokens.

    The keypair can be loaded from a PEM-encoded private key string,
    or generated ephemerally for development. Ephemeral keys are lost
    on restart, invalidating all outstanding tokens.
    """

    def __init__(self, private_key_pem: str | None = None):
        """Initialize the key manager.

        Args:
            private_key_pem: PEM-encoded RSA private key. If None or empty,
                an ephemeral key is generated for development use.
        """
        if private_key_pem:
            logger.info("Loading RSA private key from configuration")
            self._private_key = serialization.load_pem_private_key(
                private_key_pem.encode(),
                password=None,
            )
            if not isinstance(self._private_key, RSAPrivateKey):
                raise ValueError("Provided key is not an RSA private key")
        else:
            logger.warning(
                "No JWT_PRIVATE_KEY configured - generating ephemeral key. "
                "Tokens will be invalidated on restart."
            )
            self._private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
            )

        self._public_key = self._private_key.public_key()
        self._kid = self._compute_key_id()

    def _compute_key_id(self) -> str:
        """Compute a stable key ID from the public key.

        Uses first 8 bytes of SHA256 hash of the public key DER encoding.
        """
        import hashlib

        der = self._public_key.public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        return hashlib.sha256(der).hexdigest()[:16]

    @property
    def private_key(self) -> RSAPrivateKey:
        """Get the private key for signing tokens."""
        return self._private_key

    @property
    def public_key(self) -> RSAPublicKey:
        """Get the public key for verifying tokens."""
        return self._public_key

    @property
    def key_id(self) -> str:
        """Get the key ID (kid) for JWKS."""
        return self._kid

    def to_jwks(self) -> dict[str, Any]:
        """Export public key as JWKS (JSON Web Key Set).

        This can be exposed via an endpoint for servers to fetch
        and cache for token verification.

        Returns:
            JWKS dict with the public key.
        """
        # Get the public key numbers
        public_numbers = self._public_key.public_numbers()

        # Convert to base64url encoding (no padding)
        def int_to_base64url(n: int, length: int) -> str:
            data = n.to_bytes(length, byteorder="big")
            return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

        # RSA 2048 uses 256-byte modulus
        n = int_to_base64url(public_numbers.n, 256)
        e = int_to_base64url(public_numbers.e, 3)

        return {
            "keys": [
                {
                    "kty": "RSA",
                    "use": "sig",
                    "alg": "RS256",
                    "kid": self._kid,
                    "n": n,
                    "e": e,
                }
            ]
        }

    def get_public_key_pem(self) -> str:
        """Get the public key as PEM-encoded string.

        Returns:
            PEM-encoded public key.
        """
        return self._public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode("utf-8")


# Module-level singleton
_key_manager: KeyManager | None = None


def get_key_manager() -> KeyManager:
    """Get the global KeyManager instance.

    Raises:
        RuntimeError: If KeyManager has not been initialized.
    """
    if _key_manager is None:
        raise RuntimeError("KeyManager not initialized. Call init_key_manager() first.")
    return _key_manager


def init_key_manager(private_key_pem: str | None = None) -> KeyManager:
    """Initialize the global KeyManager instance.

    Args:
        private_key_pem: PEM-encoded RSA private key, or None for ephemeral.

    Returns:
        The initialized KeyManager.
    """
    global _key_manager
    _key_manager = KeyManager(private_key_pem)
    return _key_manager
