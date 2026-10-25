"""Tests for set-version.py."""

import importlib.util
import json
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "set-version.py"


def load():
    spec = importlib.util.spec_from_file_location("set_version", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_tauri_config_keeps_the_prerelease_suffix(tmp_path):
    config = tmp_path / "tauri.conf.json"
    config.write_text(json.dumps({"productName": "Loom", "version": "0.0.0"}))

    assert load().set_tauri_config_version("0.13.0-rc.1", config)

    data = json.loads(config.read_text())
    assert data["version"] == "0.13.0-rc.1"
    assert data["productName"] == "Loom"


def test_tauri_config_plain_release(tmp_path):
    config = tmp_path / "tauri.conf.json"
    config.write_text(json.dumps({"version": "0.0.0"}))

    assert load().set_tauri_config_version("1.2.3", config)

    assert json.loads(config.read_text())["version"] == "1.2.3"
