#!/usr/bin/env bash
# Build this platform on its release runner: bash .github/packages/android.sh
set -euo pipefail
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "ndk;27.2.12479018"
export NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"
pnpm tauri android init --ci
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
config=$(printf '{"bundle":{"android":{"versionCode":%d}}}' "$GITHUB_RUN_NUMBER")
pnpm tauri android build --ci --apk --config "$config"
