"""Tests for asset type detection."""

from lib.asset_detector import detect_asset_type, extract_version, is_variant


class TestDetectAssetType:
    """Test asset type detection."""

    def test_windows_setup(self):
        result = detect_asset_type('Sigilweaver-Loom-Setup-v0.2.5.exe')
        assert result['os'] == 'windows'
        assert result['id'] == 'windowsSetup'
        assert result['kind'] == 'installer'

    def test_linux_appimage(self):
        result = detect_asset_type('Sigilweaver-Loom-v0.2.5-x64.AppImage')
        assert result['os'] == 'linux'
        assert result['id'] == 'linuxAppImage'
        assert result['kind'] == 'image'

    def test_macos_dmg_arm64(self):
        result = detect_asset_type('Sigilweaver-Loom-v0.2.5-arm64.dmg')
        assert result['os'] == 'macos'
        assert result['id'] == 'macDmgArm64'
        assert result['kind'] == 'image'

    def test_macos_dmg_x64(self):
        result = detect_asset_type('Sigilweaver-Loom-v0.2.5-x64.dmg')
        assert result['os'] == 'macos'
        assert result['id'] == 'macDmgX64'
        assert result['kind'] == 'image'

    def test_linux_deb(self):
        result = detect_asset_type('Sigilweaver-Loom-v0.2.5-x64.deb')
        assert result['os'] == 'linux'
        assert result['id'] == 'linuxDeb'
        assert result['kind'] == 'package'

    def test_linux_rpm(self):
        result = detect_asset_type('Sigilweaver-Loom-v0.2.5-x64.rpm')
        assert result['os'] == 'linux'
        assert result['id'] == 'linuxRpm'
        assert result['kind'] == 'package'

    def test_web_zip(self):
        result = detect_asset_type('Sigilweaver-Loom-Web-v0.2.5.zip')
        assert result['os'] == 'web'
        assert result['id'] == 'webZip'
        assert result['kind'] == 'archive'

    def test_unknown_type(self):
        result = detect_asset_type('somefile.tar.gz')
        assert result['os'] == 'unknown'
        assert result['kind'] == 'file'


class TestIsVariant:
    """Test variant detection."""

    def test_client_variant(self):
        assert is_variant('Sigilweaver-Loom-Client-Setup.exe', 'Client')
        assert is_variant('Sigilweaver-Loom-client-v0.2.5.AppImage', 'client')

    def test_web_variant(self):
        assert is_variant('Sigilweaver-Loom-Web-v0.2.5.zip', 'Web')

    def test_not_variant(self):
        assert not is_variant('Sigilweaver-Loom-Setup.exe', 'Client')


class TestExtractVersion:
    """Test version extraction from filenames."""

    def test_basic_version(self):
        version = extract_version('Sigilweaver-Loom-Setup-v0.2.5.exe')
        assert version == 'v0.2.5'

    def test_version_with_prerelease(self):
        version = extract_version('Sigilweaver-Loom-v0.2.5-alpha.AppImage')
        assert version == 'v0.2.5-alpha'

    def test_version_with_build(self):
        version = extract_version('Sigilweaver-Loom-v1.0.0-beta.2.exe')
        assert version == 'v1.0.0-beta.2'

    def test_no_version(self):
        version = extract_version('somefile.zip')
        assert version is None
