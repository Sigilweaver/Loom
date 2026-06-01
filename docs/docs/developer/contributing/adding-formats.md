---
sidebar_position: 3
---

# Adding Data Formats

This guide walks through adding a new file format (reader) to Loom, using the
QVD reader as the worked example. Adding a tool is covered separately in
[Adding Tools](./adding-tools.md); this page is about teaching Loom to read a
new kind of *input file*.

## Overview

A format is resolved through two independent registries on the Server plus a
set of surfacing files in Studio. Every one of these must be updated or the
format will appear in one code path and fail in another.

| Side | File | Responsibility |
|------|------|----------------|
| Server | `domain/datasources/<fmt>.py` | Inspect / preview (schema + sample) |
| Server | `domain/datasources/factory.py` | Register type + file extensions |
| Server | `domain/tools/loaders/specs.py` **or** `loaders/<fmt>.py` | Execution (actual read) |
| Server | `domain/tools/loaders/factory.py` | Register the loader |
| Studio | `domain/dataSources/<fmt>Input.ts` | Front-end data-source descriptor |
| Studio | `components/config/inout/<Fmt>Configuration.tsx` | Config panel UI |
| Studio | `components/config/inout/DataSourceSelector.tsx` | Picker entry |
| Studio | `components/LeftPane.tsx` | Wiring the config panel |
| Studio | `data/toolConfigSchemas.ts` | Config schema/enum |
| Studio | `ai/prompts/system.ts` | Tell the agent the format exists |

The `type` string (for example `"qvd"`) must match exactly across the Server
registries and the Studio descriptor.

## Server

### 1. Data source (inspect / preview)

Create `server/app/domain/datasources/<fmt>.py` subclassing `DataSource`. This
powers schema inspection and previews. Use the existing
`datasources/qvd.py` as a template.

### 2. Register the data source

In `server/app/domain/datasources/factory.py`:

```python
from app.domain.datasources.myfmt import MyFmtDataSource

class DataSourceFactory:
    _sources: dict[str, Type[DataSource]] = {
        # ...
        "myfmt": MyFmtDataSource,
    }

    _extension_mapping: dict[str, str] = {
        # ...
        ".myfmt": "myfmt",
    }
```

### 3. Loader (execution)

There are two paths:

- **Polars-native, simple formats:** add a `LoaderSpec` entry to
  `server/app/domain/tools/loaders/specs.py`. `GenericLoader` will read it
  automatically. This is the preferred path - no new class required.
- **Formats needing custom logic** (eager reads wrapped in a `LazyFrame`,
  external libraries, extension-based dispatch): create
  `server/app/domain/tools/loaders/<fmt>.py` subclassing `FileLoader`, then
  register it in `loaders/factory.py` under `_special_loaders`. QVD, YXDB, and
  JSON take this path.

```python
# loaders/factory.py
from app.domain.tools.loaders.myfmt import MyFmtLoader

class LoaderFactory:
    _special_loaders: dict[str, type[FileLoader]] = {
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
4. `components/LeftPane.tsx` - render the configuration panel for the type.
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

- [ ] Server data source class + registered in `DataSourceFactory._sources`
- [ ] Extension(s) added to `DataSourceFactory._extension_mapping`
- [ ] Loader: `LoaderSpec` **or** custom loader registered in `LoaderFactory`
- [ ] `tests/test_reader_parity.py` passes
- [ ] Studio descriptor, config panel, selector, LeftPane, schema, AI prompt
- [ ] Docs and CHANGELOG updated
