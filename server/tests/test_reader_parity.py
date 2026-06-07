"""Reader-parity tests.

Loom resolves a file format through two independent registries:

- ``DataSourceFactory`` (``app.domain.datasources.factory``) powers inspection
  and preview (schema, sampling).
- ``LoaderFactory`` (``app.domain.tools.loaders.factory``) powers execution
  (actually reading the data during a workflow run).

A format must be registered in *both* or it will appear available in one code
path and fail in the other. Adding a new reader also means extending
``DataSourceFactory._extension_mapping`` so files are detected by extension.

These tests assert the registries stay in sync so the multi-file ritual of
adding a format cannot silently drift. They are the reader-side analogue of the
Studio ``toolParity`` test.
"""

from app.domain.datasources.factory import DataSourceFactory
from app.domain.tools.loaders.factory import LoaderFactory


def _source_types() -> set[str]:
    return set(DataSourceFactory.list_supported_types())


def _loader_types() -> set[str]:
    return set(LoaderFactory.list_supported_types())


def test_every_data_source_type_has_a_loader():
    """Anything inspectable/previewable must also be executable."""
    missing = sorted(t for t in _source_types() if not LoaderFactory.is_supported(t))
    assert missing == [], (
        f"Data source types with no loader (registered for inspect/preview but "
        f"not for execution): {missing}"
    )


def test_every_loader_type_has_a_data_source():
    """Anything executable must also be inspectable/previewable."""
    source_types = _source_types()
    missing = sorted(t for t in _loader_types() if t not in source_types)
    assert missing == [], (
        f"Loader types with no data source (registered for execution but not "
        f"for inspect/preview): {missing}"
    )


def test_source_and_loader_type_sets_match():
    """The two registries should describe exactly the same set of formats."""
    assert _source_types() == _loader_types()


def test_every_extension_maps_to_a_registered_type():
    """Every file extension must resolve to a type both factories support."""
    source_types = _source_types()
    for extension in DataSourceFactory.list_supported_extensions():
        detected = DataSourceFactory.detect_source_type("data" + extension)
        assert detected in source_types, (
            f"Extension {extension} maps to unknown type {detected!r}"
        )
        assert LoaderFactory.is_supported(detected), (
            f"Extension {extension} maps to type {detected!r} with no loader"
        )


def test_database_classification_agrees_between_factories():
    """Both factories must agree on which types are database connections."""
    for source_type in _source_types():
        assert DataSourceFactory.is_database_type(
            source_type
        ) == LoaderFactory.is_database_type(source_type), (
            f"Factories disagree on whether {source_type!r} is a database type"
        )


def test_registries_are_not_empty():
    """Guard against a regex/refactor wiping a registry and trivially passing."""
    assert len(_source_types()) > 0
    assert len(_loader_types()) > 0
