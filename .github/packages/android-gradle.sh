#!/usr/bin/env bash
# Invoked by Tauri during a single-ABI release. Run via bash .github/packages/android.sh.
set -euo pipefail
project=$(cd "$(dirname "$0")" && pwd)
wrapper="$project/gradlew.jotpoc-original"
case "${ANDROID_ABI:?}" in
  arm64-v8a) variant=Arm64 ;;
  armeabi-v7a) variant=Arm ;;
  x86) variant=X86 ;;
  x86_64) variant=X86_64 ;;
  *) exec "$wrapper" "$@" ;;
esac

# cargo-mobile passes --project-dir before the assemble task.
args=("$@")
if [[ ${1:-} == --project-dir && ${2:-} -ef "$project" ]]; then
  shift 2
fi
if [[ ${1:-} != "assemble${variant}Release" || $# -gt 2 ]]; then
  exec "$wrapper" "${args[@]}"
fi
lib="$project/app/src/main/jniLibs/$ANDROID_ABI/libjotpoc_lib.so"
expected="$project/../../target/$ANDROID_RUST_TARGET/release/libjotpoc_lib.so"
if [[ ! -L "$lib" || ! -s "$expected" || ! "$lib" -ef "$expected" ]]; then
  exec "$wrapper" --profile --build-cache "${args[@]}"
fi

# Match android-studio-script's validation before omitting its second Cargo invocation.
nm=("$NDK_HOME"/toolchains/llvm/prebuilt/*/bin/llvm-nm)
"${nm[0]}" -D --defined-only "$lib" | awk '
  $NF == "Java_app_tauri_plugin_PluginManager_handlePluginResponse" { found = 1 }
  END { exit !found }
' || { echo "Tauri plugin entry point missing from $lib" >&2; exit 1; }
echo "Reusing the validated $ANDROID_ABI library from this Tauri build."
exec "$wrapper" --profile --build-cache -x ":app:rustBuild${variant}Release" "${args[@]}"
