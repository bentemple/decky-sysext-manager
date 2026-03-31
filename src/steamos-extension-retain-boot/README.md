# steamos-extension-retain-boot

Forces SteamOS as next boot entry after each reboot. Useful for dual-boot setups.

## Files

### Binaries
- `/usr/sbin/steamos-extension-retain-boot` - sets boot entry
- `/usr/sbin/steamos-extension-kernel-cmdline` - shared cmdline modifier

### Systemd Units
- `steamos-extension-retain-boot.service` - runs on boot
- `steamos-extension-kernel-cmdline.service` - cmdline service
- `steamos-extension-kernel-cmdline.service.d/steamos-extension-retain-boot.conf`
