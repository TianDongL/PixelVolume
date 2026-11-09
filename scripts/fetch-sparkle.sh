#!/bin/bash
set -euo pipefail
# 2.10 raises the minimum OS to macOS 12. Keep the security-fixed 2.9 branch
# while Pixel Volume supports Intel macOS 10.15.7. Verify the official archive.
version=2.9.6
expected=52bf9e88cdd972fc0c81501377a880e90d47031bd8ca5462488f843e2609e192
cache="${PIXEL_SPARKLE_CACHE:-$HOME/Library/Caches/PixelVolumeBuild}/Sparkle-$version"
archive="$cache/Sparkle-$version.tar.xz"
mkdir -p "$cache"
if [[ ! -f "$archive" ]]; then
    curl --fail --location --retry 2 --connect-timeout 15 \
        "https://github.com/sparkle-project/Sparkle/releases/download/$version/Sparkle-$version.tar.xz" \
        --output "$archive.partial"
    printf '%s  %s\n' "$expected" "$archive.partial" | shasum -a 256 -c - >&2
    mv "$archive.partial" "$archive"
fi
printf '%s  %s\n' "$expected" "$archive" | shasum -a 256 -c - >&2
mkdir -p "$cache/dist"
tar -xJf "$archive" -C "$cache/dist"
printf '%s\n' "$cache/dist"
