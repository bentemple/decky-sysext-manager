# steamos-extension-zram

Configures zram swap + ext4 filesystem for caching frequently-written directories in RAM.

**Experimental** - slows down shutdowns/updates. Mostly a toy.

## Files

### Binaries
- `/usr/sbin/steamos-extension-zram-start` - setup script
- `/usr/sbin/steamos-extension-zram-stop` - teardown script
- `/usr/sbin/steamos-extension-zram-compact` - compaction script
- `/usr/sbin/steamos-extension-kernel-cmdline` - cmdline modifier

### Systemd Units
- `steamos-extension-zram.service` - main service
- `steamos-extension-zram-compact.service` - periodic compaction
- `steamos-extension-kernel-cmdline.service` - cmdline service

## Runtime Changes

- Creates zram swap (1/3 RAM)
- Creates zram ext4 at `/home/deck/.zram` (1/3 RAM)
- Bind mounts `~/.cache`, Steam appcache, Decky logs to zram
- Syncs to disk on shutdown
