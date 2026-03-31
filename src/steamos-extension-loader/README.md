# steamos-extension-loader

Persists extensions between system updates and auto-enables systemd units from installed extensions.

**Required** - all other extensions depend on this.

## Files

### Binaries
- `/usr/sbin/steamos-extension-loader-installer` - copies loader to /etc for persistence
- `/usr/sbin/steamos-extension-loader-system-cleaner` - removes orphaned extension files
- `/usr/bin/steamos-extension-loader-user-cleaner` - removes orphaned user extension files

### Systemd Units
- `steamos-extension-loader-installer.service` - runs installer on boot
- `steamos-extension-loader-system-cleaner.service/.timer` - periodic cleanup
- `steamos-extension-loader-user-cleaner.service/.timer` - user session cleanup
- `rauc.service.d/steam-extension-loader.conf` - unloads sysext during updates
- `systemd-sysext.service.d/steamos-extension-loader.conf` - loader integration

### Data
- `/usr/share/steamos-extension-loader` - loader script
- `/usr/share/steamos-extension-loader.service` - service template
- `/usr/share/steamos-extension-loader-atomic-update.conf` - persistence paths
