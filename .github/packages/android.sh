#!/usr/bin/env bash
# Build this platform on its release runner: bash .github/packages/android.sh
set -euo pipefail
export NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"
if [[ ! -f "$NDK_HOME/source.properties" ]]; then
  "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "ndk;27.2.12479018"
fi
rustup target add "$ANDROID_RUST_TARGET"
pnpm tauri android init --ci --skip-targets-install
# buildSrc resolves Kotlin DSL plugin dependencies independently of the app.
init_dir="${GRADLE_USER_HOME:-$HOME/.gradle}/init.d"
mkdir -p "$init_dir"
cat > "$init_dir/jotpoc-buildsrc.gradle" <<'GRADLE'
beforeSettings { settings ->
    if (settings.settingsDir.name == 'buildSrc') {
        settings.pluginManagement.repositories {
            mavenCentral()
            gradlePluginPortal()
        }
    }
}
GRADLE
# Resolve the generated buildSrc classpath before compiling the native app.
android_project=src-tauri/gen/android
gradle=("$android_project/gradlew" --project-dir "$android_project/buildSrc" --console=plain)
config_log="$RUNNER_TEMP/jotpoc-gradle-configuration.log"
if ! bash "${gradle[@]}" help > "$config_log" 2>&1; then
  cat "$config_log" >&2
  if ! grep -Eq 'Could not (resolve|find|download|get resource|GET|HEAD)' "$config_log"; then
    exit 1
  fi
  echo "Retrying Gradle dependency resolution with refreshed metadata."
  bash "${gradle[@]}" --refresh-dependencies help
fi
config=$(printf '{"bundle":{"android":{"versionCode":%d}}}' "$GITHUB_RUN_NUMBER")
pnpm tauri android build --ci --apk --split-per-abi --target "$ANDROID_TARGET" --config "$config"
