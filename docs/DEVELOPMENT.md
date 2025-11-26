# Development Guide

## Quick Reference

### Platform Status

| Platform | Development | Testing | Build | Issues |
|----------|-------------|---------|-------|--------|
| **Linux (Arch)** | ✅ Primary | ✅ Full | ✅ Works | Wayland file dialog z-order |
| **Windows (VM)** | ❌ No (tooling sucks) | ⚠️ Manual | ✅ Works | Use WSL2+Docker instead |
| **macOS** | ❌ No | ❌ **Zero** | ✅ CI only | **Need testing before v1.0** |

### Development Environment

**Arch Linux** (any distro works - venv + package-lock = portable):
```bash
# Dependencies
sudo pacman -S base-devel python nodejs npm git

# Setup
git clone https://github.com/sigilweaver/sigilweaver-app.git
cd sigilweaver-app
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"
cd ../frontend && npm install

# Daily workflow
./scripts/dev.sh          # Both services
./scripts/test.sh         # All tests
./scripts/build.sh        # Complete build
```

**Windows Developers**: Use WSL2 + Docker Dev Containers (insulates from Windows dev tool weirdness)

**macOS**: Have x86 MacBook (running Arch), GitHub Actions runner (disabled). Need to reinstall macOS or find testing alternative before v1.0.

## Pre-Launch Critical Path

1. ❌ **Test macOS builds** (reinstall macOS on laptop or cloud Mac)
2. ❌ Re-enable GitHub Actions macOS runner
3. ❌ Migrate scripts to Python (cross-platform, everyone has it)
4. ⚠️ Test on X11 once (low priority, Wayland primary)

## Known Issues

**Linux (Wayland)**:
- File dialog z-order issue (GTK/Electron/Wayland integration)
- Not supporting X11 (not a priority)

**Windows**:
- Development tooling is terrible (not hardware - VM is 8c/32GB)
- Path separators, line endings

**macOS**:
- Zero testing done (main blocker)
- Builds generated via CI but untested
- Likely: Gatekeeper/notarization issues when testing starts

## Development Standards

- **Line endings**: LF everywhere (not CRLF)
- **Paths**: Always use `path.join()` / `pathlib.Path`
- **Scripts**: Shell for now, migrating to Python
- **Tests**: Focus on domain logic/state/tools, not UI (see `TESTING_STRATEGY.md`)

## Quick Commands

```bash
# Development
./scripts/dev.sh              # Start both services
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev && npm run electron

# Testing
./scripts/test.sh             # All tests
./scripts/test_backend.sh     # Backend only
./scripts/test_frontend.sh    # Frontend only

# Building
./scripts/build.sh            # Complete app
cd frontend && npm run build:linux   # Linux only
cd frontend && npm run build:win     # Windows only
cd frontend && npm run build:mac     # macOS only
```

## Cross-Platform Tips

**Bad**:
```typescript
const path = '/home/user/file.csv';  // Linux-only
execSync('ls -la');                  // Platform-specific
```

**Good**:
```typescript
import path from 'path';
const filePath = path.join(os.homedir(), 'data', 'file.csv');
const files = readdirSync(dir);  // Use fs module, not shell commands
```

## CI/CD

GitHub Actions matrix (when enabled):
- Linux: ubuntu-latest
- Windows: windows-latest  
- macOS: macos-latest (currently disabled)

## Resources

- `TESTING_STRATEGY.md` - Test philosophy and patterns
- `TODO.md` - Feature roadmap
- Backend: `backend/docs/`
- Frontend: `frontend/docs/`
