# steamos-extension-preload

Pre-caches frequently-loaded files to minimize latency.

## External Dependencies

- **preload** - https://sourceforge.net/projects/preload/ (GPL-2.0)
  - Binary embedded in extension

## Files

### Binaries
- `/usr/sbin/steamos-extension-preload` - preload binary
- `/usr/sbin/steamos-extension-preload-wrapper` - wrapper script

### Systemd Units
- `steamos-extension-preload.service` - runs preload daemon

## Runtime Changes

Creates `/var/lib/preload.state` (persists after uninstall).
