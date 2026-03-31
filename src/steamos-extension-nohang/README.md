# steamos-extension-nohang

Minimizes system latency during low-memory conditions via nohang daemon.

## External Dependencies

- **nohang** - https://github.com/hakavlad/nohang (MIT License)
  - Downloaded at build time, pinned version in `upstream.lock`

## Files

### Binaries
- `/usr/sbin/steamos-extension-nohang` - nohang daemon binary

### Systemd Units
- `steamos-extension-nohang.service` - runs nohang daemon

### Config
- `/usr/share/steamos-extension-nohang-desktop.conf` - nohang config
- `/usr/share/steamos-extension-nohang-LICENSE` - upstream license
