"""pytest configuration and shared fixtures."""

import pytest


@pytest.fixture
def sample_assets_dir(tmp_path):
    """Create a temporary directory with sample release assets."""
    assets = tmp_path / "release-assets"
    assets.mkdir()

    # Create sample files
    files = [
        "Sigilweaver-Loom-Setup-v0.2.5.exe",
        "Sigilweaver-Loom-Portable-v0.2.5.exe",
        "Sigilweaver-Loom-v0.2.5-x64.AppImage",
        "Sigilweaver-Loom-v0.2.5-x64.snap",
        "Sigilweaver-Loom-Client-Setup-v0.2.5.exe",
        "Sigilweaver-Loom-Client-v0.2.5-x64.AppImage",
        "Sigilweaver-Loom-Web-v0.2.5.zip",
        "SHA256SUMS.txt",
    ]

    for filename in files:
        (assets / filename).write_text(f"Mock content for {filename}")

    return assets


@pytest.fixture
def version():
    """Sample version string."""
    return "v0.2.5"


@pytest.fixture
def base_url():
    """Sample base URL."""
    return "https://download.sigilweaver.app"
