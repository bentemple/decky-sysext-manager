# steamos-extension-hibernate-after-sleep

Auto-hibernates after configurable suspend duration (default 60min). Configures swap, GRUB resume, and Bluetooth fixes.

## Files

### Binaries
- `/usr/sbin/steamos-extension-hibernate-after-sleep-install` - setup script
- `/usr/sbin/steamos-extension-hibernate-after-sleep-fix-bluetooth` - post-resume BT fix
- `/usr/sbin/steamos-extension-hibernate-after-sleep-mark-boot-good` - marks boot successful

### Systemd Units
- `steamos-extension-hibernate-after-sleep-install.service` - runs setup on boot
- `steamos-extension-hibernate-after-sleep-fix-bluetooth.service` - BT fix after resume
- `steamos-extension-hibernate-after-sleep-mark-boot-good.service` - boot marker

### Docs
- `/usr/share/doc/steamos-extension-hibernate-after-sleep/example-config`
- `/usr/share/doc/steamos-extension-hibernate-after-sleep/README`
- `/usr/sbin/steamos-extension-hibernate-after-sleep-uninstall`

## Runtime Changes

Setup script modifies:
- `/etc/systemd/sleep.conf.d/` - hibernate delay config
- `/home/deck/swapfile` - swap file (default 20GB)
- GRUB config - resume parameters
- Copies uninstaller to `/home/deck/.bin/`
