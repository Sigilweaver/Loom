# Sigilweaver Loom Documentation

[![CC BY-SA 4.0](https://img.shields.io/badge/License-CC%20BY--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/)

The documentation site for Sigilweaver Loom, built with [Docusaurus](https://docusaurus.io/).

**Live site**: [sigilweaver.app/loom/docs](https://sigilweaver.app/loom/docs)

## License

The documentation is licensed under the [Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/) (CC BY-SA 4.0). The software itself is AGPL-3.0. See [LICENSE.md](LICENSE.md) for the documentation license text.

## Structure

```
docs/
|-- docs/
|   |-- intro.md            # Landing page
|   |-- roadmap.md
|   |-- user/               # Studio user guide
|   |   |-- interface/      # Canvas, settings, connections, AI, Hub
|   |   |-- expressions/    # Polars expressions
|   |   `-- tools/          # One page per tool
|   |-- admin/              # Hub and Server administration
|   `-- developer/          # Architecture, contributing, testing, building
|-- src/css/                # Theme customizations
|-- static/                 # Images and fonts
|-- plugins/                # Local Docusaurus plugins
|-- docusaurus.config.ts    # Site configuration
`-- sidebars.ts             # Sidebar navigation (edit this when you add a page)
```

## Working on the docs

You need [Bun](https://bun.sh) and the Node version pinned in the repository's `.nvmrc`.

```bash
cd docs
bun install --frozen-lockfile
bun run start        # dev server at http://localhost:25809
```

From the repository root, `./scripts/dev.py --docs` starts the same dev server.

### Check your change

CI runs exactly these two commands. Run them before you open a pull request:

```bash
bun run typecheck
bun run build:cloudflare    # fails on broken links
```

Also read the build output. Docusaurus prints broken anchors and broken markdown links as warnings.

## Writing style

- Write for the reader who wants to do something. Prefer short sentences and task-based headings.
- Use plain ASCII punctuation: hyphens, straight quotes and three periods. Do not use em dashes, en dashes, smart quotes or emoji.
- Use one name for each concept. Studio, Server and Hub are proper nouns. Say "workflow", "tool", "wire", "socket" and "connection". The palette names a tool shows in Studio (Read, Write, Schema, Calculate, Concatenate, Aggregate) come first, with the type name in parentheses on first use.
- Do not name AI models or vendors' model versions. Provider names are fine.
- Check every claim against the code: environment variables and defaults, ports, menu labels, endpoints and file paths.
- Do not write "coming soon" pages. If a feature does not exist, leave it out or list it on the [roadmap](docs/roadmap.md).
- Code blocks should run as written.

### Frontmatter

```markdown
---
sidebar_position: 1
title: Page Title
description: One sentence for search engines and link previews
---
```

`title` is required for pages whose first heading is not a good sidebar label. Use `sidebar_label` for a shorter sidebar entry.

### Links

Link to other pages with relative file paths, and include the `.md` extension so the build can check them:

```markdown
See [Getting Started](./user/getting-started.md).
```

### Admonitions

```markdown
:::note
Extra information.
:::

:::tip
A helpful hint.
:::

:::caution
Something to be careful about.
:::

:::warning
Something that can cause data loss or a security problem.
:::
```

### Diagrams

Mermaid diagrams work in fenced `mermaid` blocks.

### Adding a page

1. Create the `.md` file under the right section.
2. Add it to `sidebars.ts`. The sidebar is explicit, so an unlisted page is not reachable from navigation.
3. Run the checks above.

Do not move or rename a page that Studio links to. Studio's tool help links point at `user/tools/...`, `user/expressions/basics`, `user/data-types` and `user/interface/ai-assistant`.

## Deployment

CI builds the site (`.github/workflows/docs.yml`) but does not publish it. The site is served under `/loom/docs` on sigilweaver.app from the static build in `build/`, configured by `wrangler.jsonc`.

## Contributing

Documentation fixes are welcome. Open an issue first for large restructures. See the [Contributing Workflow](docs/developer/contributing/workflow.md).
