# Decky Sysext Manager

Decky sysext manager is a steamdeck decky plugin for managing systemd-sysext extensions.

## Response Style
Always explain your reasoning step by step.
When analyzing code, consider multiple angles.
If you're uncertain, state your assumptions.

## Architecture Overview

**Backend (Python):**
- `ExtensionManager` - Core business logic (all async methods)
- `SystemOps` interface - Abstraction for system calls (file I/O, subprocess, systemctl)
  - `RealSystemOps` - Production implementation
  - `MockSystemOps` - Test implementation (in `tests/conftest.py`)
- Returns dicts with `{"success": bool, ...}` - never raises exceptions

**Frontend (React/TypeScript):**
- Functional components with hooks
- Backend calls via `serverAPI.callPluginMethod(method, args)`
- Decky UI: `showModal()` returns `{ Close }` - call `Close()` to dismiss

**Extensions:**
- Live in `src/steamos-extension-*/` with `overlayfs/` directory
- `manifest.yaml` defines metadata, config params, activation mode
- Scripts: `install`, `uninstall`, `configure`, `update-manager`
- Built into `.raw` files (squashfs) via `scripts/build-extension.sh`

## Key Patterns

**Config Parsing:**
- Backend strips unit suffixes: `"60min"` → `60`, `"20GB"` → `20`
- Unit metadata tracked from manifest

**Activation Modes:**
- `reboot` - Always requires reboot
- `auto`/`hot-reload` - Try `systemd-sysext refresh`, fallback to reboot

**Update Manager:**
- Version checks cached for 6 hours
- Flags: `--get-current-version`, `--get-latest-version`, `--update`

## Testing

```bash
# Run all tests
pnpm test

# Run specific test
.venv/bin/python -m pytest tests/test_extension_manager.py::TestClass::test_name -xvs
```

**Test Coverage:**
- Enable/disable/update extensions
- Configuration parsing and script execution
- Update manager (caching, error cases)
- Status logic (active/pending/unloaded/disabled)
- Service management
- Error handling

**Mock Setup:**
```python
mock_sys.add_manifest("ext-id", {manifest_dict}, plugin_dir)
mock_sys.add_bundled_raw("ext-id", plugin_dir)
mock_sys.add_installed_raw("ext-id")
mock_sys.command_outputs["cmd args"] = (stdout, stderr, returncode)
```

## Scripts

```bash
# Build extension
./scripts/build-extension.sh src/steamos-extension-{name}

# Validate .raw files
./scripts/validate-extensions.sh

# Build plugin
decky plugin build
```

## Code Style

**Python:**
- Async everywhere
- Type hints on signatures
- Return `{"success": False, "error": msg}` dicts
- Use `self._log(level, message)` for logging

**TypeScript:**
- Functional components
- Async/await for backend calls
- Destructuring props/state

**Tests:**
- Fixture-based (`manager`, `mock_sys`, `plugin_dir`)
- Descriptive names: `test_does_something_when_condition`
- Arrange-Act-Assert pattern
