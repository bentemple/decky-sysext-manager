# steamos-extension-irqbalance

Balances CPU interrupts across cores while minimizing active cores for power efficiency.

## External Dependencies

- **irqbalance** - https://github.com/Irqbalance/irqbalance (GPL-2.0)
  - Binary embedded in extension

## Files

### Binaries
- `/usr/sbin/steamos-extension-irqbalance` - irqbalance binary (statically compiled)

### Systemd Units
- `steamos-extension-irqbalance.service` - runs irqbalance daemon with `--powerthresh=1`
