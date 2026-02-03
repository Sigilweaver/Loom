# Personal DevContainer Configuration

Copy this folder to `.devcontainer/personal/` to add your own settings.

```bash
cp -r .devcontainer/personal.example .devcontainer/personal
```

Then edit the files in `personal/` with your own values. The folder is gitignored.

## Files

| File | Purpose |
|------|---------|
| `gitconfig.json` | Git identity (name, email) and custom aliases |
| `settings.json` | VS Code settings applied inside the container |
| `.gitignore-global` | Personal gitignore patterns (not project-specific) |

## How it works

The `post-create.py` script automatically detects and applies these settings when the container is created.
