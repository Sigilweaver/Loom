"""Tests for manifest generation."""

import sys
from pathlib import Path
import json
import pytest

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.manifest_builder import ManifestBuilder


class TestManifestBuilder:
    """Test manifest generation."""
    
    def test_stable_manifest_structure(self, sample_assets_dir, version, base_url):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        manifest = builder.build_stable_manifest('abc123')
        
        assert manifest['schemaVersion'] == 1
        assert manifest['channel'] == 'stable'
        assert manifest['version'] == version
        assert manifest['commit'] == 'abc123'
        assert 'date' in manifest
        assert 'assets' in manifest
        assert isinstance(manifest['assets'], list)
    
    def test_stable_manifest_excludes_checksums(self, sample_assets_dir, version, base_url):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        manifest = builder.build_stable_manifest('abc123')
        
        # Should not include SHA256SUMS.txt
        filenames = [asset['fileName'] for asset in manifest['assets']]
        assert 'SHA256SUMS.txt' not in filenames
    
    def test_asset_has_required_fields(self, sample_assets_dir, version, base_url):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        manifest = builder.build_stable_manifest('abc123')
        
        asset = manifest['assets'][0]
        assert 'id' in asset
        assert 'os' in asset
        assert 'arch' in asset
        assert 'kind' in asset
        assert 'fileName' in asset
        assert 'url' in asset
        assert 'size' in asset
        assert 'sha256' in asset
    
    def test_asset_url_construction(self, sample_assets_dir, version, base_url):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        manifest = builder.build_stable_manifest('abc123')
        
        asset = manifest['assets'][0]
        assert asset['url'].startswith(base_url)
        assert f'/releases/{version}/' in asset['url']
        # URL should use the original versioned filename
        assert 'Sigilweaver-Web-v0.2.5-alpha.zip' in asset['url']
        # fileName should also keep the original versioned name
        assert asset['fileName'] == 'Sigilweaver-Web-v0.2.5-alpha.zip'
    
    def test_downloads_manifest_structure(self, sample_assets_dir, version, base_url):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        manifest = builder.build_downloads_manifest()
        
        assert manifest['schemaVersion'] == 1
        assert manifest['version'] == version
        assert 'variants' in manifest
        assert 'full' in manifest['variants']
        assert 'client' in manifest['variants']
        assert 'web' in manifest['variants']
    
    def test_downloads_manifest_categorizes_variants(self, sample_assets_dir, version, base_url):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        manifest = builder.build_downloads_manifest()
        
        # Check that Client files are in client variant
        client_files = [a['fileName'] for a in manifest['variants']['client']]
        assert any('Client' in f for f in client_files)
        
        # Check that Web files are in web variant
        web_files = [a['fileName'] for a in manifest['variants']['web']]
        assert any('Web' in f for f in web_files)
    
    def test_update_releases_index_creates_new(self, sample_assets_dir, version, base_url):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        index = builder.update_releases_index(None)
        
        assert index['schemaVersion'] == 1
        assert index['latest'] == version
        assert len(index['releases']) == 1
        assert index['releases'][0]['version'] == version
        assert 'manifestUrl' in index['releases'][0]
    
    def test_update_releases_index_appends_release(self, sample_assets_dir, version, base_url):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        
        existing = {
            'schemaVersion': 1,
            'generatedAt': '2025-01-01T00:00:00Z',
            'latest': 'v0.2.4',
            'releases': [
                {
                    'version': 'v0.2.4',
                    'date': '2025-01-01T00:00:00Z',
                    'manifestUrl': 'https://example.com/releases/v0.2.4/manifest.json'
                }
            ]
        }
        
        index = builder.update_releases_index(existing)
        
        assert index['latest'] == version
        assert len(index['releases']) == 2
        versions = [r['version'] for r in index['releases']]
        assert version in versions
        assert 'v0.2.4' in versions
    
    def test_update_releases_index_replaces_duplicate(self, sample_assets_dir, version, base_url):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        
        existing = {
            'schemaVersion': 1,
            'generatedAt': '2025-01-01T00:00:00Z',
            'latest': version,
            'releases': [
                {
                    'version': version,
                    'date': '2025-01-01T00:00:00Z',
                    'manifestUrl': 'https://example.com/old-url'
                }
            ]
        }
        
        index = builder.update_releases_index(existing)
        
        # Should still have only one entry for this version
        assert len(index['releases']) == 1
        assert index['releases'][0]['version'] == version
