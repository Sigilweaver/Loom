"""pytest configuration and shared fixtures."""

import pytest


@pytest.fixture
def sample_assets_dir(tmp_path):
    """Create a temporary directory with sample release assets."""
    assets = tmp_path / "release-assets"
    assets.mkdir()

    # Create sample files
    files = [
        "Sigilweaver-Setup-v0.2.5-alpha.exe",
        "Sigilweaver-Portable-v0.2.5-alpha.exe",
        "Sigilweaver-v0.2.5-alpha-x64.AppImage",
        "Sigilweaver-v0.2.5-alpha-x64.snap",
        "Sigilweaver-Client-Setup-v0.2.5-alpha.exe",
        "Sigilweaver-Client-v0.2.5-alpha-x64.AppImage",
        "Sigilweaver-Web-v0.2.5-alpha.zip",
        "SHA256SUMS.txt",
    ]

    for filename in files:
        (assets / filename).write_text(f"Mock content for {filename}")

    return assets


@pytest.fixture
def version():
    """Sample version string."""
    return "v0.2.5-alpha"


@pytest.fixture
def base_url():
    """Sample base URL."""
    return "https://download.sigilweaver.app"
