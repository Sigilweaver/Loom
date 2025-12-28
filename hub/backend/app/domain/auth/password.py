"""Password hashing utilities using Argon2

Argon2 is the winner of the Password Hashing Competition (2015) and is
recommended for new applications. It provides memory-hard hashing that
resists GPU/ASIC attacks.

This module provides simple hash/verify functions for use in auth flows.
"""

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

# Default parameters provide good security/performance balance
# - time_cost: iterations (higher = slower/more secure)
# - memory_cost: KB of memory used (higher = more GPU-resistant)
# - parallelism: number of threads
_hasher = PasswordHasher(
    time_cost=2,
    memory_cost=65536,  # 64 MB
    parallelism=1,
)


def hash_password(password: str) -> str:
    """Hash a password using Argon2id.

    Args:
        password: The plaintext password to hash.

    Returns:
        The hashed password string (includes algorithm params and salt).

    Example:
        >>> hashed = hash_password("hunter2")
        >>> hashed.startswith("$argon2id$")
        True
    """
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash.

    Args:
        password: The plaintext password to verify.
        password_hash: The stored hash to verify against.

    Returns:
        True if the password matches, False otherwise.

    Example:
        >>> hashed = hash_password("hunter2")
        >>> verify_password("hunter2", hashed)
        True
        >>> verify_password("wrong", hashed)
        False
    """
    try:
        _hasher.verify(password_hash, password)
        return True
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    """Check if a password hash needs to be rehashed.

    This returns True if the hash was created with different parameters
    than the current hasher configuration. Use this to upgrade hashes
    when security parameters are increased.

    Args:
        password_hash: The stored hash to check.

    Returns:
        True if the hash should be regenerated, False otherwise.
    """
    return _hasher.check_needs_rehash(password_hash)
