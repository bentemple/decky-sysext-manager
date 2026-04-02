# steamos-extension-tailscale

Persists Tailscale VPN across SteamOS updates using a systemd-sysext overlay.

---

## This Extension (Our Scripts)

These files are part of the steamos-extensions project and are not from the upstream Tailscale repository.

### Runtime scripts (installed into the sysext overlay)

| File | Description |
|------|-------------|
| `/usr/sbin/steamos-extension-tailscale-manager` | Boot-time manager. Checks if Tailscale is already installed and enabled; if so, skips the install. Otherwise runs `tailscale.sh` and records the installed version to the state file. |
| `/usr/sbin/steamos-extension-tailscale-uninstall` | Uninstall wrapper script (sourced from the `deck-tailscale` submodule's `uninstall.sh`). |

### Systemd unit

| File | Description |
|------|-------------|
| `overlayfs/usr/lib/systemd/system/steamos-extension-tailscale.service` | Runs `steamos-extension-tailscale-manager` on boot, after `network-online.target`. |
| `overlayfs/usr/lib/systemd/system-preset/00-steamos-extension-tailscale.conf` | Enables the service by default when the sysext is loaded. |

### Decky plugin integration

| File | Description |
|------|-------------|
| `update-manager` | Called by the Decky plugin for version tracking. Supports `--get-current-version` (reads from state file or binary), `--get-latest-version` (fetches from `pkgs.tailscale.com`), and `--update` (runs `tailscale.sh`). |
| `configure` | Config script stub (no configurable parameters currently). |
| `uninstall` | Uninstall script invoked by the Decky plugin when the extension is disabled. |
| `manifest.yaml` | Extension manifest defining metadata, activation mode, and update-manager. |

### State files (written at runtime, not in the sysext overlay)

| Path | Description |
|------|-------------|
| `/home/deck/.local/share/steamos-extension-tailscale/version` | Records the currently installed Tailscale version, written by `steamos-extension-tailscale-manager` after each successful install. |

Note: latest-version query results are cached by the Decky plugin backend (24h TTL) so that version checks don't hit the network on every open.

---

## Upstream Scripts (deck-tailscale submodule)

These files come from [tailscale-dev/deck-tailscale](https://github.com/tailscale-dev/deck-tailscale) and are copied **verbatim** by the `build` script. They are never modified.

| Source file | Installed path | Description |
|-------------|---------------|-------------|
| `deck-tailscale/tailscale.sh` | `/usr/share/steamos-extension-tailscale/tailscale.sh` | The Tailscale installer script. Downloads the latest stable release, installs binaries to `/opt/tailscale/`, sets up the systemd service, and starts it. |
| `deck-tailscale/override.conf` | `/usr/share/steamos-extension-tailscale/override.conf` | systemd service drop-in that points `tailscaled` at the binary in `/opt/tailscale/`. |
| `deck-tailscale/uninstall.sh` | `/usr/sbin/steamos-extension-tailscale-uninstall` | Removes the Tailscale installation. |

To update these files from the submodule, run the `build` script:

```bash
cd src/steamos-extension-tailscale
./build
```

---

## What the Installer Does to the System

When `tailscale.sh` runs (via `steamos-extension-tailscale-manager`), it makes the following persistent changes outside the sysext overlay:

| Path | Description |
|------|-------------|
| `/opt/tailscale/tailscale` | Tailscale CLI binary |
| `/opt/tailscale/tailscaled` | Tailscale daemon binary |
| `/etc/systemd/system/tailscaled.service` | systemd service unit for the Tailscale daemon |
| `/etc/systemd/system/tailscaled.service.d/override.conf` | Drop-in that sets the binary path to `/opt/tailscale/tailscaled` (backed up as `override.conf.bak` if it already exists) |
| `/etc/default/tailscaled` | Daemon defaults file (`PORT` and `FLAGS`). Not overwritten if it already exists. |
| `/etc/profile.d/tailscale.sh` | Adds `/opt/tailscale` to `$PATH`. Not overwritten if it already exists. |
| `/etc/atomic-update.conf.d/tailscale.conf` | Marks the above files for preservation across SteamOS atomic updates. |

The installer then enables and starts `tailscaled` via `systemctl`.

### First-time setup

After the extension is enabled and the system reboots, Tailscale will be running but not yet authenticated. To join your Tailnet:

```bash
tailscale up --qr --operator=deck --ssh
```

Scan the QR code with your phone to authenticate.
