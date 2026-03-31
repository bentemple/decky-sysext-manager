# steamos-extension-prelockd

Prevents executable memory pages from swapping to reduce latency.

## External Dependencies

- **prelockd** - https://github.com/hakavlad/prelockd (MIT License)
  - Downloaded at build time, pinned version in `upstream.lock`

## Files

### Binaries
- `/usr/sbin/steamos-extension-prelockd` - prelockd daemon binary

### Systemd Units
- `steamos-extension-prelockd.service` - runs prelockd daemon

### Config
- `/usr/share/steamos-extension-prelockd.conf` - prelockd config
- `/usr/share/steamos-extension-prelockd-LICENSE` - upstream license
