"""
Test imports to verify module structure is correct.
"""


def test_imports():
    """Verify all modules can be imported."""
    from lib.asset_detector import detect_asset_type

    # Basic smoke test
    result = detect_asset_type("test.exe")
    assert result["os"] == "windows"

    print("All imports successful!")


if __name__ == "__main__":
    test_imports()
