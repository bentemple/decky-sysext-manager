# steamos-extension-update-decky-loader

Auto-updates Decky Loader (stable channel). Restarts Steam client on update.

**Note:** Cannot perform initial Decky install. Only updates existing installations.

## Files

### Binaries
- `/usr/sbin/steamos-extension-update-decky-loader` - update script

### Systemd Units
- `steamos-extension-update-decky-loader.service` - runs updater
- `steamos-extension-update-decky-loader.timer` - scheduled trigger
