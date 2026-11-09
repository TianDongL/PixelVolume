#!/bin/bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
[[ $# == 1 && -f "$1" && "$1" == *.xml ]] || { echo 'Usage: sign-macos-feed.sh appcast.xml' >&2; exit 1; }
sparkle="$(bash "$root/scripts/fetch-sparkle.sh")"
"$sparkle/bin/sign_update" --account pixel-volume-release "$1"
"$sparkle/bin/sign_update" --account pixel-volume-release --verify "$1"
