# Sigilweaver Loom Documentation

[![CC BY-SA 4.0](https://img.shields.io/badge/License-CC%20BY--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/)

The official documentation site for Sigilweaver Loom, built with [Docusaurus](https://docusaurus.io/).

**Live site**: [sigilweaver.app/loom/docs](https://sigilweaver.app/loom/docs)

## License

This documentation is licensed under the **Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA 4.0)**.

You are free to:
- **Share** - Copy and redistribute the material in any medium or format
- **Adapt** - Remix, transform, and build upon the material for any purpose, even commercially

Under the following terms:
- **Attribution** - You must give appropriate credit and indicate if changes were made
- **ShareAlike** - If you remix or transform the material, you must distribute your contributions under the same license

See [LICENSE](LICENSE.md) for the full text.

## Structure

```
docs/
├── docs/
│   ├── admin/                # Hub administration
│   ├── developer/            # Developer documentation
│   │   ├── architecture/     # Architecture decisions (ADRs)
│   │   ├── building/         # Build guides
│   │   ├── contributing/     # Contribution guides
│   │   ├── reference/        # API reference
│   │   └── testing/          # Testing guides
│   ├── user/                 # End-user documentation
│   │   ├── crash-courses/    # Coming from other tools
│   │   ├── expressions/      # Expression language
│   │   ├── interface/        # UI documentation
│   │   └── tools/            # Tool reference
│   ├── code-of-conduct.md    # Community guidelines
│   └── intro.md              # Getting started
├── src/                      # Docusaurus customizations
├── static/                   # Static assets (images, etc.)
├── docusaurus.config.ts      # Site configuration
└── sidebars.ts               # Sidebar navigation
```

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd docs
npm install
```

### Local Development

```bash
npm run start
```

This starts a local development server at `http://localhost:3000`. Most changes are reflected live without restarting.

### Build

```bash
npm run build
```

Generates static content into the `build/` directory. You can serve this locally with:

```bash
npm run serve
```

### Check for Broken Links

```bash
npm run build  # Build will fail on broken links
```

## Writing Documentation

### File Format

All documentation is written in Markdown with optional MDX (JSX in Markdown) support.

### Frontmatter

Each page needs frontmatter:

```markdown
---
title: Page Title
description: Brief description for SEO
sidebar_position: 1
---

# Page Title

Content goes here...
```

### Admonitions

Use admonitions for callouts:

```markdown
:::tip
Helpful tip here
:::

:::warning
Something to be careful about
:::

:::danger
Critical warning
:::
```

### Code Blocks

Specify the language for syntax highlighting:

````markdown
```python
import polars as pl
df = pl.read_csv("data.csv")
```
````

### Internal Links

Use relative paths for internal links:

```markdown
See the [Getting Started](./intro.md) guide.
```

## Deployment

Documentation is automatically deployed to [sigilweaver.app/loom/docs](https://sigilweaver.app/loom/docs) when changes are pushed to the main branch.

### Manual Deployment

For manual deployment to GitHub Pages:

```bash
# Using SSH
USE_SSH=true npm run deploy

# Using HTTPS
GIT_USER=<Your GitHub username> npm run deploy
```

## Contributing

We welcome documentation contributions! Please:

1. Follow the existing style and tone
2. Test locally before submitting
3. Keep pages focused and scannable
4. Include code examples where helpful

For major changes, please open an issue first to discuss.

---

<p align="center">
  <a href="https://creativecommons.org/licenses/by-sa/4.0/">
    <img src="https://licensebuttons.net/l/by-sa/4.0/88x31.png" alt="CC BY-SA 4.0" />
  </a>
</p>
