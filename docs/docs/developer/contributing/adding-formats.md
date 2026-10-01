---
sidebar_position: 3
---

# Adding Data Formats

This guide walks through adding a new file format (reader) to Loom, using the
QVD reader as the worked example. Adding a tool is covered separately in
[Adding Tools](./adding-tools.md); this page is about teaching Loom to read a
new kind of *input file*.

## Overview

A format is described once in the central registry and read through two paths:
inspection/preview (`DataSourceFactory`) and execution (`LoaderFactory`). Both
factories derive their type lists, extension map, and loaders from
`app/domain/registry.py`, so you register the format in one place on the server.

| Side | File | Responsibility |
|------|------|----------------|
| Server | `domain/registry.py` | **Single source of truth**: type, extensions, datasource, loader flag |
| Server | `domain/datasources/<fmt>.py` | Inspect / preview (schema + sample) |
| Server | `domain/tools/loaders/specs.py` **or** `loaders/<fmt>.py` | Execution (actual read) |
| Studio | `domain/dataSources/<fmt>Input.ts` | Front-end data-source descriptor |
| Studio | `components/config/inout/<Fmt>Configuration.tsx` | Config panel UI |
| Studio | `components/config/inout/DataSourceSelector.tsx` | Picker entry |
| Studio | `components/config/inout/SourceConfigurationPanel.tsx` | Wiring the config panel |
| Studio | `data/toolConfigSchemas.ts` | Config schema/enum |
| Studio | `ai/prompts/system.ts` | Tell the agent the format exists |

The `type` string (for example `"qvd"`) must match exactly across the registry
and the Studio descriptor.

## Server

### 1. Data source (inspect / preview)

Create `server/app/domain/datasources/<fmt>.py` subclassing `DataSource`. This
powers schema inspection and previews. Use the existing
`datasources/qvd.py` as a template.

### 2. Register the format

Add a `FormatDescriptor` to `FILE_FORMATS` in
`server/app/domain/registry.py`. This single entry feeds both factories - the
type, its file extensions, the data source class, and whether it needs a
special loader:

```python
# server/app/domain/registry.py
FILE_FORMATS: tuple[FormatDescriptor, ...] = (
    # ...
    FormatDescriptor("myfmt", (".myfmt",), MyFmtDataSource),
    # set special_loader=True if it needs a custom loader (see step 3):
    # FormatDescriptor("myfmt", (".myfmt",), MyFmtDataSource, special_loader=True),
)
```

### 3. Loader (execution)

There are two paths:

- **Polars-native, simple formats:** leave `special_loader=False` and add a
  `LoaderSpec` entry to `server/app/domain/tools/loaders/specs.py` keyed by your
  `type`. `GenericLoader` reads it automatically - no new class required.
- **Formats needing custom logic** (eager reads wrapped in a `LazyFrame`,
  external libraries, extension-based dispatch): create
  `server/app/domain/tools/loaders/<fmt>.py` subclassing `FileLoader`, set
  `special_loader=True` on the descriptor, and bind the class in
  `LoaderFactory._LOADER_CLASSES` (keyed by `type`). QVD, YXDB, and JSON take
  this path.

```python
# loaders/factory.py
_LOADER_CLASSES: dict[str, type[FileLoader]] = {
    # ...
    "myfmt": MyFmtLoader,
}
```

### 4. Verify registry parity

`server/tests/test_reader_parity.py` asserts the two registries agree. Run it:

```bash
cd server
uv run pytest tests/test_reader_parity.py -q
```

If you registered the data source but forgot the loader (or vice versa), this
test fails with the exact missing type.

## Studio

Mirror the format on the front end. Use the QVD files as templates:

1. `domain/dataSources/<fmt>Input.ts` - the data-source descriptor (type,
   label, options).
2. `components/config/inout/<Fmt>Configuration.tsx` - the options panel.
3. `components/config/inout/DataSourceSelector.tsx` - add the picker entry.
4. `components/config/inout/SourceConfigurationPanel.tsx` - render the configuration panel for the type.
5. `data/toolConfigSchemas.ts` - add the config schema / enum value.
6. `ai/prompts/system.ts` - mention the format so the agent can suggest it.

## Documentation

Keep the docs in sync (see [the QVD entry](../../user/tools/input-output/input.md)
for the pattern):

- `docs/docs/user/tools/input-output/input.md` - user-facing format section.
- `docs/docs/developer/reference/api-endpoints.md` - the
  `GET /api/datasource/supported` example.
- `docs/docs/developer/architecture/backend.md` - the data source overview.
- `CHANGELOG.md` - an entry under `[Unreleased] > Added`.

## Checklist

- [ ] Server data source class in `domain/datasources/<fmt>.py`
- [ ] `FormatDescriptor` added to `FILE_FORMATS` in `domain/registry.py`
- [ ] Loader: `LoaderSpec` **or** custom loader bound in `LoaderFactory._LOADER_CLASSES` (with `special_loader=True`)
- [ ] `tests/test_reader_parity.py` passes
- [ ] Studio descriptor, config panel, selector, SourceConfigurationPanel, schema, AI prompt
- [ ] Docs and CHANGELOG updated
