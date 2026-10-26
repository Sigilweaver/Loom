# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Sigilweaver Loom Backend
Builds a standalone executable with all dependencies bundled
"""

import sys
from pathlib import Path

block_cipher = None

# Determine paths
spec_root = Path(SPECPATH)

a = Analysis(
    ['app/main.py'],
    pathex=[str(spec_root)],
    binaries=[],
    datas=[
        ('app', 'app'),  # Include all app code
    ],
    hiddenimports=[
        # FastAPI/Uvicorn requirements
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        
        # Polars
        'polars',
        'polars._utils',
        
        # FastAPI
        'fastapi',
        'starlette',
        'pydantic',
        'pydantic_core',
        
        # Excel support
        'fastexcel',
        'fastexcel._fastexcel',
        'xlsxwriter',
        
        # Database/SQL support
        'connectorx',
        
        # Other dependencies
        'multipart',
        'python_multipart',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'pytest',
        'mypy',
        'ruff',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='server',  # scripts/build.py expects dist/server[.exe]
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # MUST be True for uvicorn logging to work on Windows
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
