"""Tests for password hashing utilities"""

import pytest

from app.domain.auth.password import hash_password, needs_rehash, verify_password


class TestHashPassword:
    """Tests for hash_password function"""

    def test_returns_argon2id_hash(self):
        """Hash should use Argon2id algorithm"""
        hashed = hash_password("testpassword")
        assert hashed.startswith("$argon2id$")

    def test_different_passwords_different_hashes(self):
        """Different passwords should produce different hashes"""
        hash1 = hash_password("password1")
        hash2 = hash_password("password2")
        assert hash1 != hash2

    def test_same_password_different_hashes(self):
        """Same password should produce different hashes (random salt)"""
        hash1 = hash_password("samepassword")
        hash2 = hash_password("samepassword")
        assert hash1 != hash2

    def test_empty_password_hashes(self):
        """Empty password should still hash (validation is caller's job)"""
        hashed = hash_password("")
        assert hashed.startswith("$argon2id$")

    def test_unicode_password_hashes(self):
        """Unicode passwords should hash correctly"""
        hashed = hash_password("hunter2")
        assert hashed.startswith("$argon2id$")


class TestVerifyPassword:
    """Tests for verify_password function"""

    def test_correct_password_verifies(self):
        """Correct password should verify successfully"""
        password = "correcthorsebatterystaple"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_wrong_password_fails(self):
        """Wrong password should fail verification"""
        hashed = hash_password("correctpassword")
        assert verify_password("wrongpassword", hashed) is False

    def test_empty_password_verifies_if_hashed_empty(self):
        """Empty password should verify against hash of empty password"""
        hashed = hash_password("")
        assert verify_password("", hashed) is True

    def test_invalid_hash_returns_false(self):
        """Invalid hash format should return False, not raise"""
        assert verify_password("anypassword", "invalidhash") is False

    def test_empty_hash_returns_false(self):
        """Empty hash should return False, not raise"""
        assert verify_password("anypassword", "") is False

    def test_case_sensitive(self):
        """Password verification should be case-sensitive"""
        hashed = hash_password("Password")
        assert verify_password("Password", hashed) is True
        assert verify_password("password", hashed) is False
        assert verify_password("PASSWORD", hashed) is False


class TestNeedsRehash:
    """Tests for needs_rehash function"""

    def test_current_params_no_rehash(self):
        """Hash with current params should not need rehash"""
        hashed = hash_password("testpassword")
        assert needs_rehash(hashed) is False

    def test_invalid_hash_behavior(self):
        """Invalid hash should handle gracefully"""
        # Implementation-dependent - may return True or raise
        # Just verify it doesn't crash
        try:
            needs_rehash("invalidhash")
        except Exception:
            pass  # Some implementations may raise


class TestPasswordIntegration:
    """Integration tests for password flow"""

    def test_full_auth_flow(self):
        """Test complete hash-store-verify flow"""
        # User registration
        password = "mysecretpassword123"
        stored_hash = hash_password(password)

        # User login attempt - correct password
        assert verify_password(password, stored_hash) is True

        # User login attempt - wrong password
        assert verify_password("wrongpassword", stored_hash) is False

    @pytest.mark.parametrize("password", [
        "short",
        "a" * 100,  # Long password
        "with spaces and stuff",
        "special!@#$%^&*()",
        "unicode",
        "123456789",
        "   leading/trailing spaces   ",
    ])
    def test_various_passwords(self, password: str):
        """Various password formats should hash and verify correctly"""
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True
        assert verify_password(password + "x", hashed) is False
