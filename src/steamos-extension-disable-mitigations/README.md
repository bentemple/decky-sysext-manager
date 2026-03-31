# steamos-extension-disable-mitigations

Adds `mitigations=off` kernel parameter. Potential performance gain at security cost.

**Warning:** Makes installation less secure. Understand spectre-like vulnerabilities before using.

## Files

### Binaries
- `/usr/sbin/steamos-extension-disable-mitigations` - adds kernel param
- `/usr/sbin/steamos-extension-kernel-cmdline` - shared cmdline modifier

### Systemd Units
- `steamos-extension-disable-mitigations.service` - applies param
- `steamos-extension-kernel-cmdline.service` - cmdline update service
- `steamos-extension-kernel-cmdline.service.d/steamos-extension-disable-mitigations.conf` - drop-in

## Runtime Changes

Modifies GRUB config to add `mitigations=off`. Causes additional reboot after updates.
