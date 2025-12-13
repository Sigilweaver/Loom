"""File loaders package for Input tool

This package provides a data-driven approach to file loading. Instead of
separate classes per format, most formats are handled by GenericLoader
using declarative LoaderSpec configurations from specs.py.

To add a new format:
1. Add a LoaderSpec to LOADER_SPECS in specs.py
2. That's it! The factory will automatically use GenericLoader with your spec.

For formats requiring special logic (like JSON's extension detection),
create a custom loader class and register it in LoaderFactory._special_loaders.
"""

from app.domain.tools.loaders.base import FileLoader
from app.domain.tools.loaders.factory import LoaderFactory
from app.domain.tools.loaders.generic import GenericLoader
from app.domain.tools.loaders.json import JsonLoader
from app.domain.tools.loaders.specs import LOADER_SPECS, LoaderSpec

__all__ = [
    "FileLoader",
    "GenericLoader",
    "JsonLoader",
    "LoaderFactory",
    "LoaderSpec",
    "LOADER_SPECS",
]
