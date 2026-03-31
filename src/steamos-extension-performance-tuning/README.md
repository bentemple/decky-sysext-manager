# steamos-extension-performance-tuning

Applies performance tweaks and AC/battery-aware CPU governor/NVMe tuning via udev rules.

## Files

### Binaries
- `/usr/sbin/steamos-extension-performance-tuning` - main tuning script
- `/usr/sbin/steamos-extension-performance-tuning-dispatch` - udev dispatcher
- `/usr/sbin/steamos-extension-performance-tuning-udev-*` - per-subsystem handlers
- `/usr/sbin/steamos-extension-kernel-cmdline` - cmdline modifier

### Systemd Units
- `steamos-extension-performance-tuning.service` - applies tunings
- `steamos-extension-kernel-cmdline.service` - cmdline updates
- `steamos-extension-kernel-cmdline.service.d/steamos-extension-performance-tuning.conf`

### udev Rules
- `99-steamos-extension-performance-tuning-btrfs.rules`
- `99-steamos-extension-performance-tuning-charging.rules`
- `99-steamos-extension-performance-tuning-discharging.rules`
- `99-steamos-extension-performance-tuning-mmcblk.rules`
- `99-steamos-extension-performance-tuning-nvme.rules`
- `99-steamos-extension-performance-tuning-sd.rules`
- `99-steamos-extension-performance-tuning-wifi.rules`
- `99-steamos-extension-performance-tuning-zram.rules`

### Libs
- `/usr/lib/steamos-extension-performance-tuning.zsh` - shared functions

## Runtime Changes

Modifies kernel cmdline. Causes additional reboot after updates.
