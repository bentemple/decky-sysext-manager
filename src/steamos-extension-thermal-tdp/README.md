# steamos-extension-thermal-tdp

Dynamic TDP management: bursts to 20W then throttles to 15W based on temperature.

**Steam Deck only** - may set inappropriate values on other AMD SoCs.

## Files

### Binaries
- `/usr/sbin/steamos-extension-thermal-tdp` - TDP daemon

### Systemd Units
- `steamos-extension-thermal-tdp.service` - runs daemon

### Source
- `/usr/src/thermal-tdp.c` - daemon source code
