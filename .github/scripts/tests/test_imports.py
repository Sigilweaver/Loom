"""
Test imports to verify module structure is correct.
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

def test_imports():
    """Verify all modules can be imported."""
    from lib.asset_detector import detect_asset_type, is_variant, extract_version
    from lib.manifest_builder import ManifestBuilder
    from lib.b2_uploader import B2Uploader
    
    # Basic smoke test
    result = detect_asset_type('test.exe')
    assert result['os'] == 'windows'
    
    print("All imports successful!")


if __name__ == '__main__':
    test_imports()
