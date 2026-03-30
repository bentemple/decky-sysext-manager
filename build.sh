#!/usr/bin/env zsh
set -ex

# Sort all preset files (check both old and new structure)
find . -path '*/usr/*' -iname '*.preset' | xargs -rI{} sort -o {} {}

# Download external dependencies
# Note: paths updated for overlayfs structure when extensions are migrated
function download_nohang() {
    local base_dir=$1
    curl 'https://raw.githubusercontent.com/hakavlad/nohang/refs/heads/master/LICENSE' > $base_dir/usr/share/steamos-extension-nohang-LICENSE
    curl 'https://raw.githubusercontent.com/hakavlad/nohang/refs/heads/master/src/nohang' > $base_dir/usr/sbin/steamos-extension-nohang
    chmod 644 $base_dir/usr/share/steamos-extension-nohang-LICENSE
    chmod 755 $base_dir/usr/sbin/steamos-extension-nohang
}

function download_prelockd() {
    local base_dir=$1
    curl 'https://raw.githubusercontent.com/hakavlad/prelockd/refs/heads/master/LICENSE' > $base_dir/usr/share/steamos-extension-prelockd-LICENSE
    curl 'https://raw.githubusercontent.com/hakavlad/prelockd/refs/heads/master/prelockd' > $base_dir/usr/sbin/steamos-extension-prelockd
    chmod 644 $base_dir/usr/share/steamos-extension-prelockd-LICENSE
    chmod 755 $base_dir/usr/sbin/steamos-extension-prelockd
}

# Download to correct location based on structure
if [[ -d src/steamos-extension-nohang/overlayfs ]]; then
    download_nohang src/steamos-extension-nohang/overlayfs
else
    download_nohang src/steamos-extension-nohang
fi

if [[ -d src/steamos-extension-prelockd/overlayfs ]]; then
    download_prelockd src/steamos-extension-prelockd/overlayfs
else
    download_prelockd src/steamos-extension-prelockd
fi

function compress() {
	local target=$1
	shift
	mksquashfs $@ $target \
		-reproducible -mkfs-time 0 -all-time 0 \
		-root-uid 0 -root-gid 0 \
		-force-uid 0 -force-gid 0 \
		-root-mode 777 -root-time 0 -all-root \
		-no-exports -no-xattrs -tailends \
		-keep-as-directory -no-strip \
		-comp zstd -b 128K \
		-mem 8G -processors $(nproc --all) \
		-Xcompression-level 22 \
		-read-queue 2048 \
		-write-queue 2048 \
		-fragment-queue 2048
}

local assets_dir=$(pwd)/assets/extensions/
if [[ ! -d $assets_dir ]]; then
    mkdir -p $assets_dir
fi
local temp=$(mktemp -d)
for dir in src/steamos-extension-*(/N); do
	# Check for new overlayfs structure, fall back to old structure
	local source_dir=$dir
	local ext_name=$(basename $dir)
	if [[ -d $dir/overlayfs ]]; then
		source_dir=$dir/overlayfs
	fi

	rsync $source_dir/ -rav --delete --delete-before $temp
	mkdir -p $temp/usr/lib/extension-release.d
	echo 'ID=_any' > $temp/usr/lib/extension-release.d/extension-release.$ext_name
	if [[ -e $assets_dir/$ext_name.raw ]]; then
		rm -rf $assets_dir/$ext_name.raw
	fi
	pushd $temp
	compress $assets_dir/$ext_name.raw *
	popd

done
rm -rf $temp

for extension in /var/lib/extensions/*.raw(N); do
	local basename=$(echo $extension | rev | cut -f2- -d. | cut -f1 -d/ | rev)
	if ! [[ -d src/$basename ]]; then
		rm -rf $extension
	fi
done
