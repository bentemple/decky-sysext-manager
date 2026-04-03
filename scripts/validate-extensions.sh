#!/bin/bash
# Validates that checked-in .raw files match the source overlayfs/ directories.
# Uses native squashfs-tools (unsquashfs) to extract and compare.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$ROOT_DIR/assets/extensions"

echo "Validating checked-in .raw files against source..."
echo ""

FAILED=0

for ext_dir in "$ROOT_DIR"/steamos-extension-*/; do
    ext_name=$(basename "$ext_dir")
    raw_file="$ASSETS_DIR/$ext_name.raw"
    source_dir="$ext_dir/overlayfs"

    printf "  %s... " "$ext_name"

    # Check if raw file exists
    if [[ ! -f "$raw_file" ]]; then
        echo "FAILED"
        echo "    Error: Raw file not found: $raw_file"
        FAILED=1
        continue
    fi

    # Check if source exists
    if [[ ! -d "$source_dir" ]]; then
        echo "FAILED"
        echo "    Error: Source directory not found: $source_dir"
        FAILED=1
        continue
    fi

    # Create temp directory for extraction
    temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" EXIT

    # Extract the .raw file
    if ! unsquashfs -d "$temp_dir/extracted" "$raw_file" >/dev/null 2>&1; then
        echo "FAILED"
        echo "    Error: Failed to extract $raw_file"
        FAILED=1
        rm -rf "$temp_dir"
        continue
    fi

    # Compare directories (excluding extension-release.d which is generated)
    # Use diff -r to compare recursively
    diff_output=$(diff -rq \
        --exclude='extension-release.d' \
        "$source_dir" "$temp_dir/extracted" 2>&1) || true

    if [[ -n "$diff_output" ]]; then
        echo "FAILED"
        echo "    Error: Content mismatch"
        echo "$diff_output" | head -5 | sed 's/^/    /'
        FAILED=1
    else
        echo "OK"
    fi

    rm -rf "$temp_dir"
    trap - EXIT
done

echo ""

if [[ $FAILED -eq 1 ]]; then
    echo "Validation failed! Some .raw files are out of sync with source."
    echo "Run ./build-extension-images.sh to rebuild and commit the updated assets/extensions/ files."
    exit 1
else
    echo "All extensions validated successfully!"
fi
