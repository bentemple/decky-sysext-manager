#!/bin/bash
# Bundles extension files into dist/ for the Decky plugin.
# Called as part of pnpm build.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$ROOT_DIR/assets/extensions"
DIST_DIR="$ROOT_DIR/dist/extensions"
PY_MODULES_DIR="$ROOT_DIR/py_modules"

echo "Installing Python dependencies..."
if [[ -f "$ROOT_DIR/requirements.txt" ]]; then
    VENV_DIR="$ROOT_DIR/.venv"
    if [[ ! -d "$VENV_DIR" ]]; then
        python3 -m venv "$VENV_DIR"
    fi
    "$VENV_DIR/bin/pip" install --target="$PY_MODULES_DIR" -r "$ROOT_DIR/requirements.txt" --upgrade
    echo "  Python dependencies installed to py_modules/"
else
    echo "  WARNING: No requirements.txt found"
fi

echo "Bundling extensions..."

# Create dist directory
mkdir -p "$DIST_DIR"

# Helper to check if extension is disabled
is_disabled() {
    local manifest="$1"
    grep -qE '^status:\s*disabled' "$manifest" 2>/dev/null
}

# Copy manifest/configure/uninstall from source directories (skip disabled)
for ext_dir in "$ROOT_DIR"/src/steamos-extension-*/; do
    ext_name=$(basename "$ext_dir")
    manifest="$ext_dir/manifest.yaml"

    # Skip disabled extensions
    if [[ -f "$manifest" ]] && is_disabled "$manifest"; then
        echo "  Skipping disabled extension: $ext_name"
        continue
    fi

    # Copy .raw file if it exists
    raw_file="$ASSETS_DIR/$ext_name.raw"
    if [[ -f "$raw_file" ]]; then
        cp "$raw_file" "$DIST_DIR/"
    fi

    # Copy manifest
    if [[ -f "$manifest" ]]; then
        cp "$manifest" "$DIST_DIR/$ext_name.yaml"
    fi

    # Copy configure script
    if [[ -f "$ext_dir/configure" ]]; then
        cp "$ext_dir/configure" "$DIST_DIR/$ext_name.configure"
    fi

    # Copy uninstall script
    if [[ -f "$ext_dir/uninstall" ]]; then
        cp "$ext_dir/uninstall" "$DIST_DIR/$ext_name.uninstall"
    fi
done

echo "  Copied manifests and scripts"
echo "Extensions bundled!"
