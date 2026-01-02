# Sigilweaver Studio

The visual workflow designer - a desktop application for building data pipelines.

## What is Studio?

Studio is where you design your workflows. It's a desktop application that gives you an infinite canvas where you can drag tools, wire them together, and preview your data at any step.

Studio is built with:
- **[React](https://react.dev/)** - For the user interface
- **[Xyflow](https://xyflow.com/)** - For the node-based canvas
- **[Electron](https://www.electronjs.org/)** - For native desktop distribution

## Key Features

### Visual Workflow Design

Drag tools from the library, drop them on the canvas, and connect them with wires. See your entire pipeline at a glance.

### Real-Time Preview

Click any tool to see its output. Inspect your data at any stage without running the full workflow.

### Undo/Redo

Full history tracking. Made a mistake? Just undo it.

### Portable Workflows

Workflows are saved as `.swwf` files (JSON format). Share them with colleagues, check them into version control, or back them up anywhere.

## Running Studio

### From Release

Download from [sigilweaver.app/downloads](https://sigilweaver.app/downloads) and run the installer for your platform.

### From Source

```bash
cd studio
npm install
npm run dev
```

Studio runs at `http://localhost:25810` in dev mode. You'll need a Server running at `localhost:25811` to execute workflows.

### With Electron

```bash
cd studio
npm run dev      # Terminal 1: Start Vite dev server
npm run electron  # Terminal 2: Launch Electron (after Vite starts)
```

## Connecting to a Backend

Studio needs a backend to execute workflows:

| Mode | When to Use |
|------|-------------|
| **Local Server** | Development, single-user. Connect directly to Server on localhost. |
| **Hub** | Teams, multiple servers. Authenticate with Hub, which routes to servers. |

Configure your connection in **Settings > Connection**.

## File Format

Workflows are saved as `.swwf` files:

```json
{
  "version": "1.0",
  "meta": {
    "name": "My Workflow",
    "author": "User"
  },
  "tools": [...],
  "wires": [...]
}
```

## For Developers

For architecture details, state management patterns, and how to add new tools, see:
- [Developer Documentation](https://docs.sigilweaver.app/developer/contributing/frontend)
- [CONTRIBUTING.md](CONTRIBUTING.md) (quick reference)

## License

AGPLv3 - See [LICENSE](LICENSE.md).
