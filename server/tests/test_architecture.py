"""Layering rules: the domain layer must not depend on the HTTP/API layer (#82)."""

import ast
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[1] / "app"

# Packages that must stay free of web-framework and API-layer imports.
DOMAIN_PACKAGES = ("domain", "utils")
FORBIDDEN_PREFIXES = ("app.api", "fastapi", "starlette")


def _imports(path: Path) -> list[tuple[int, str]]:
    found: list[tuple[int, str]] = []
    for node in ast.walk(ast.parse(path.read_text(), filename=str(path))):
        if isinstance(node, ast.Import):
            found.extend((node.lineno, alias.name) for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            found.append((node.lineno, node.module))
    return found


def _domain_files() -> list[Path]:
    return sorted(
        path
        for package in DOMAIN_PACKAGES
        for path in (APP_DIR / package).rglob("*.py")
        if "__pycache__" not in path.parts
    )


@pytest.mark.parametrize("path", _domain_files(), ids=lambda p: str(p.relative_to(APP_DIR)))
def test_domain_layer_does_not_import_api_layer(path: Path):
    offending = [
        f"line {lineno}: {module}"
        for lineno, module in _imports(path)
        if module == "app.api"
        or any(module == p or module.startswith(p + ".") for p in FORBIDDEN_PREFIXES)
    ]
    assert not offending, (
        f"{path.relative_to(APP_DIR)} imports the API layer or a web framework: {offending}. "
        "Raise a domain exception (app.utils.errors) and map it in app/api/exception_handlers.py."
    )
