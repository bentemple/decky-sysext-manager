# steamos-extension-compat-tools

Auto-installs/updates Boxtron, Luxtorpeda, Roberta, and Proton GE to latest versions.

## Files

### Binaries
- `/usr/bin/steamos-extension-compat-tools-flatpak` - flatpak helper
- `/usr/bin/steamos-extension-compat-tools-update-boxtron` - Boxtron updater
- `/usr/bin/steamos-extension-compat-tools-update-luxtorpeda` - Luxtorpeda updater
- `/usr/bin/steamos-extension-compat-tools-update-protonge` - Proton GE updater
- `/usr/bin/steamos-extension-compat-tools-update-roberta` - Roberta updater
- `/usr/sbin/steamos-extension-compat-tools-install-deps` - dependency installer

### Systemd Units (system)
- `steamos-extension-compat-tools-install-deps.service` - installs flatpak deps

### Systemd Units (user)
- `steamos-extension-compat-tools-update-boxtron.service/.timer`
- `steamos-extension-compat-tools-update-luxtorpeda.service/.timer`
- `steamos-extension-compat-tools-update-protonge.service/.timer`
- `steamos-extension-compat-tools-update-roberta.service/.timer`
