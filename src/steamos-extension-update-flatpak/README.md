# steamos-extension-update-flatpak

Scheduled repair/update of all flatpaks with dependency cleanup.

## Files

### Binaries
- `/usr/sbin/steamos-extension-update-flatpak` - system flatpak updater
- `/usr/bin/steamos-extension-update-user-flatpak` - user flatpak updater

### Systemd Units (system)
- `steamos-extension-update-flatpak.service` - runs system update
- `steamos-extension-update-flatpak.timer` - scheduled trigger

### Systemd Units (user)
- `steamos-extension-update-user-flatpak.service` - runs user update
- `steamos-extension-update-user-flatpak.timer` - scheduled trigger
