#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

app="$PWD/out/Pixel Volume.app"
helper="$app/Contents/Library/LoginItems/Pixel Volume Login.app"
sdk="$(xcrun --sdk macosx --show-sdk-path)"
target() {
    case "$1" in
        x86_64) echo x86_64-apple-macosx10.15.7 ;;
        arm64) echo arm64-apple-macosx11.0 ;;
    esac
}

bundle() {
    local dest="$1"
    mkdir -p "$dest/Contents/MacOS" "$dest/Contents/Resources"
    cp Info.plist "$dest/Contents/Info.plist"
    cp SliderResident.html DesktopBridge.html SliderResident-MIT.txt "$dest/Contents/Resources/"
}

compile() {
    local arch="$1" target="$2"
    shift 2
    xcrun swiftc -swift-version 5 -O -sdk "$sdk" -target "$(target "$arch")" \
        -framework AppKit -framework WebKit -framework ApplicationServices -framework CoreAudio \
        -framework AudioToolbox -framework ServiceManagement \
        "$@" AudioOutput.swift VolumeKeys.swift LoginStartup.swift UpdateClient.swift WelcomeWindow.swift main.swift -o "$target"
}

bundle "$app"
compile arm64 out/pixel-arm64
compile x86_64 out/pixel-x86_64
xcrun lipo -create out/pixel-arm64 out/pixel-x86_64 -output "$app/Contents/MacOS/PixelVolume"
plutil -lint "$app/Contents/Info.plist"

mkdir -p "$helper/Contents/MacOS"
cp LoginLauncher-Info.plist "$helper/Contents/Info.plist"
for arch in arm64 x86_64; do
    xcrun swiftc -swift-version 5 -O -sdk "$sdk" -target "$(target "$arch")" \
        -framework AppKit LoginLauncher.swift -o "out/launcher-$arch"
done
xcrun lipo -create out/launcher-arm64 out/launcher-x86_64 -output "$helper/Contents/MacOS/PixelVolumeLogin"
plutil -lint "$helper/Contents/Info.plist"

if [[ "${PIXEL_SIGN:-adhoc}" == developer ]]; then
    identity="$(security find-identity -v -p codesigning | awk '/Developer ID Application:/{print $2}')"
    [[ "$identity" =~ ^[0-9A-F]{40}$ ]] || { echo '需要一张可用的 Developer ID Application 签名身份' >&2; exit 1; }
    for item in "$helper" "$app"; do
        codesign --force --options runtime --timestamp --sign "$identity" "$item"
    done
else
    codesign --force --sign - "$helper"
    codesign --force --sign - "$app"
fi
codesign --verify --deep --strict --all-architectures "$app"
xcrun lipo -archs "$app/Contents/MacOS/PixelVolume"

qa() {
    local arch="$1" name="$2" id="$3" legacy="$4"
    local test_app="$PWD/out/$name.app"
    bundle "$test_app"
    /usr/libexec/PlistBuddy -c "Set CFBundleIdentifier com.tiandong.pixelvolume.test.$id" "$test_app/Contents/Info.plist"
    /usr/libexec/PlistBuddy -c "Set CFBundleDisplayName $name" "$test_app/Contents/Info.plist"
    if [[ "$legacy" == true ]]; then
        /usr/libexec/PlistBuddy -c 'Add PixelTestLegacyCanvas bool true' "$test_app/Contents/Info.plist"
    fi
    compile "$arch" "$test_app/Contents/MacOS/PixelVolume" -D PIXEL_TEST
    codesign --force --sign - "$test_app"
}

# Test app bundles are opt-in and must never be produced by a normal user build.
if [[ "${PIXEL_BUILD_QA:-0}" == 1 ]]; then
    qa arm64 'Pixel Volume QA' arm false
    qa "${PIXEL_LEGACY_QA_ARCH:-arm64}" 'Pixel Volume Legacy QA' legacy true
fi
