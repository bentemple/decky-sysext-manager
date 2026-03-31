# Extension Manifest Format

Each extension requires a `manifest.yaml` file in its directory that describes the extension's metadata, activation behavior, and optional configuration.

## Basic Structure

```yaml
name: "Extension Name"
id: "extension-id"
description: "Brief description of what the extension does"
version: "1.0.0"
category: "system"

activation:
  mode: reboot
```

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable display name |
| `id` | string | Unique identifier (used for filenames, must match directory suffix) |
| `description` | string | Brief description shown in the UI |
| `version` | string | Semantic version (e.g., "1.0.0") |
| `category` | string | Category for grouping in UI |
| `activation` | object | How the extension activates |

## Categories

Extensions are grouped by category in the UI:

- `system` - Core system functionality
- `network` - Networking and VPN
- `power` - Power management and battery
- `performance` - Performance tuning
- `utilities` - General utilities
- `boot` - Boot process modifications
- `other` - Uncategorized

## Activation Modes

```yaml
activation:
  mode: reboot | hot-reload | auto
```

| Mode | Behavior |
|------|----------|
| `reboot` | Always requires a reboot to activate/deactivate |
| `hot-reload` | Attempts live activation via `systemd-sysext refresh` |
| `auto` | Same as `hot-reload` - tries live activation, falls back to reboot if needed |

Use `reboot` for extensions that modify:
- GRUB configuration
- Swap/hibernation setup
- Early boot services

Use `auto` or `hot-reload` for extensions that only add:
- User services
- Scripts
- Configuration files

## Optional Fields

### `required`

```yaml
required: true
```

Marks the extension as required (currently only used for the loader extension).

### `status`

```yaml
status: release | experimental | disabled
```

Controls where the extension appears in the UI:

| Value | Behavior |
|-------|----------|
| `release` | Shown in main "Extensions" tab - stable, tested extensions |
| `experimental` | Shown in "Experimental" tab - work-in-progress or untested (default) |
| `disabled` | Excluded from build entirely |

If not specified, defaults to `experimental`.

## Configuration Section

For extensions with user-configurable parameters:

```yaml
config:
  path: "/path/to/config/file"
  parameters:
    - id: ParameterName
      label: "Display Label"
      description: "What this parameter controls"
      type: integer | duration | boolean | select
      default: 60
      unit: "min"        # Optional display unit
      min: 5             # Optional minimum (for integer/duration)
      max: 960           # Optional maximum
      step: 5            # Optional step increment
```

### Parameter Types

| Type | Description | Additional Fields |
|------|-------------|-------------------|
| `integer` | Numeric value | `min`, `max`, `step`, `unit` |
| `duration` | Time value in minutes | `min`, `max`, `step`, `unit` |
| `boolean` | True/false toggle | - |
| `select` | Dropdown selection | `options` |

### Select Options

```yaml
- id: LogLevel
  label: "Log Level"
  type: select
  default: "info"
  options:
    - value: "debug"
      label: "Debug"
    - value: "info"
      label: "Info"
    - value: "warn"
      label: "Warning"
```

## Configure Script

For extensions that need to apply configuration changes:

```yaml
configure:
  script: "./configure"
```

The script receives parameters as command-line arguments:
```bash
./configure --ParameterName=value --OtherParam=value
```

## Uninstall Section

For extensions that need cleanup when disabled:

```yaml
uninstall:
  script: "./uninstall"
  prompts:
    - id: cleanup_data
      message: "Remove all saved data?"
      default: false
```

### Uninstall Prompts

Prompts are shown to the user before disabling. The script receives answers as arguments:

```bash
./uninstall --cleanup_data=true --other_prompt=false
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Argument name passed to script |
| `message` | string | Question shown to user |
| `default` | boolean | Default selection |

## Complete Example

```yaml
name: "Hibernate After Sleep"
id: "hibernate-after-sleep"
description: "Auto-hibernate after configurable suspend time to save battery"
version: "1.0.0"
category: "power"

activation:
  mode: reboot

config:
  path: "/home/deck/.config/hibernate-after-sleep"
  parameters:
    - id: HibernateDelaySec
      label: "Hibernate Delay"
      description: "Time to wait before hibernating after suspend"
      type: duration
      default: 60
      unit: "min"
      min: 5
      max: 960
      step: 5

    - id: TargetSwapFileSizeInGbs
      label: "Swap File Size"
      description: "Size of swap file for hibernation"
      type: integer
      default: 20
      unit: "GB"
      min: 8
      max: 64
      step: 1

configure:
  script: "./configure"

uninstall:
  script: "./uninstall"
  prompts:
    - id: resize_swapfile
      message: "Resize swapfile back to 1GB?"
      default: false
```

## Directory Structure

```
src/steamos-extension-{id}/
├── manifest.yaml          # Required: Extension metadata
├── README.md              # Required: Detailed documentation
├── overlayfs/             # Required: Files to overlay on system
│   └── usr/
│       ├── lib/
│       │   └── systemd/
│       │       └── system/
│       │           └── my-service.service
│       └── sbin/
│           └── my-script
├── configure              # Optional: Configuration script
├── uninstall              # Optional: Uninstall/cleanup script
└── build                  # Optional: Build-time script
```
