#!/bin/bash
# Bundles extension files into dist/ for the Decky plugin.
# Called as part of pnpm build.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$ROOT_DIR/assets/extensions"
DIST_DIR="$ROOT_DIR/dist/extensions"

echo "Bundling extensions..."

# Create dist directory
mkdir -p "$DIST_DIR"

# Copy .raw files from assets
if ls "$ASSETS_DIR"/*.raw 1>/dev/null 2>&1; then
    cp "$ASSETS_DIR"/*.raw "$DIST_DIR/"
    echo "  Copied .raw files"
else
    echo "  WARNING: No .raw files found in assets/extensions/"
fi

# Copy manifest/configure/uninstall from source directories
for ext_dir in "$ROOT_DIR"/src/steamos-extension-*/; do
    ext_name=$(basename "$ext_dir")

    # Copy manifest
    if [[ -f "$ext_dir/manifest.yaml" ]]; then
        cp "$ext_dir/manifest.yaml" "$DIST_DIR/$ext_name.yaml"
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
