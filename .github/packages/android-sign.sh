#!/usr/bin/env bash
# Sign the built APK on the release runner: bash .github/packages/android-sign.sh
set -euo pipefail
: "${KEYSTORE:?Configure the Android release keystore}"
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "build-tools;35.0.0"
tools="$ANDROID_HOME/build-tools/35.0.0"
mapfile -t apks < <(find src-tauri/gen/android/app/build/outputs/apk -name '*.apk')
test "${#apks[@]}" = 1
printf '%s' "$KEYSTORE" | base64 -d > "$RUNNER_TEMP/release.keystore"
mkdir -p packages
"$tools/zipalign" -P 16 -f 4 "${apks[0]}" "$RUNNER_TEMP/aligned.apk"
"$tools/apksigner" sign --ks "$RUNNER_TEMP/release.keystore" --ks-key-alias "$KEY_ALIAS" --ks-pass env:STORE_PASSWORD --key-pass env:KEY_PASSWORD --out packages/JotPoc.apk "$RUNNER_TEMP/aligned.apk"
"$tools/apksigner" verify packages/JotPoc.apk
