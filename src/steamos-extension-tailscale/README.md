# steamos-extension-tailscale

Persists Tailscale VPN across SteamOS updates.

## External Dependencies

- **Tailscale** - https://tailscale.com (BSD-3-Clause License)
  - Downloaded at runtime from https://pkgs.tailscale.com/stable/
  - Installed to `/opt/tailscale/`

## Files

### Binaries
- `/usr/sbin/steamos-extension-tailscale` - install/update script (from deck-tailscale)
- `/usr/sbin/steamos-extension-tailscale-uninstall` - uninstall script

### Systemd Units
- `steamos-extension-tailscale.service` - runs installer on boot

### Config
- `/usr/share/steamos-extension-tailscale/override.conf` - tailscaled service override

## Runtime Changes

The install script creates:
- `/opt/tailscale/tailscale` - CLI binary
- `/opt/tailscale/tailscaled` - daemon binary
- `/etc/systemd/system/tailscaled.service` - service file
- `/etc/systemd/system/tailscaled.service.d/override.conf` - binary path overrides
- `/etc/default/tailscaled` - daemon config
- `/etc/profile.d/tailscale.sh` - PATH addition
- `/etc/atomic-update.conf.d/tailscale.conf` - persistence paths
- `/var/lib/tailscale/` - state directory
