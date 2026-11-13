#!/usr/bin/env bash
# Build this platform on its release runner: bash .github/packages/android.sh
set -euo pipefail
ndk_version=$(cat .github/packages/android-ndk-version)
export NDK_HOME="$ANDROID_HOME/ndk/$ndk_version"
if [[ ! -f "$NDK_HOME/source.properties" ]]; then
  "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "ndk;$ndk_version"
fi
stage_start=$SECONDS
record_stage() {
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf '| %s | %ds |\n' "$1" "$((SECONDS - stage_start))" >> "$GITHUB_STEP_SUMMARY"
  fi
  stage_start=$SECONDS
}
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf '### Android %s\n\n| Build stage | Duration |\n| --- | ---: |\n' "$ANDROID_TARGET" >> "$GITHUB_STEP_SUMMARY"
fi
stage='Rust target and Android project initialization'
trap 'record_stage "$stage (failed)"' ERR
rustup target add "$ANDROID_RUST_TARGET"
pnpm tauri android init --ci --skip-targets-install
record_stage "$stage"
stage='Gradle dependency resolution'
# Enable task output caching for both the preflight and Tauri's Gradle invocation.
export GRADLE_OPTS="${GRADLE_OPTS:-} -Dorg.gradle.caching=true"
# buildSrc resolves Kotlin DSL plugin dependencies independently of the app.
init_dir="${GRADLE_USER_HOME:-$HOME/.gradle}/init.d"
mkdir -p "$init_dir"
cat > "$init_dir/jotpoc-buildsrc.gradle" <<'GRADLE'
beforeSettings { settings ->
    if (settings.settingsDir.name == 'buildSrc') {
        settings.pluginManagement.repositories {
            maven {
                url = uri("https://maven-central.storage-download.googleapis.com/maven2")
                content { includeGroup("org.jetbrains.kotlin") }
            }
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
    record_stage "$stage (failed)"
    exit 1
  fi
  echo "Retrying Gradle dependency resolution with refreshed metadata."
  bash "${gradle[@]}" --refresh-dependencies help
fi
record_stage "$stage"
stage='Tauri release build and APK assembly'
# Tauri builds the selected release library before starting Gradle. Only reuse
# a link created during this invocation, never one left by a previous build.
abi=${ANDROID_ABI:?Supply the APK ABI selected by the build matrix}
native_link="$android_project/app/src/main/jniLibs/$abi/libjotpoc_lib.so"
if [[ -L "$native_link" ]]; then
  unlink "$native_link"
elif [[ -e "$native_link" ]]; then
  echo "Expected a Tauri-managed JNI symlink at $native_link" >&2
  exit 1
fi
wrapper="$android_project/gradlew"
original="$android_project/gradlew.jotpoc-original"
[[ ! -e "$original" ]] || { echo "Original Gradle wrapper already exists at $original" >&2; exit 1; }
mv "$wrapper" "$original"
trap 'mv -f "$original" "$wrapper"' EXIT
cp .github/packages/android-gradle.sh "$wrapper"
chmod +x "$wrapper"
config=$(printf '{"bundle":{"android":{"versionCode":%d}}}' "$GITHUB_RUN_NUMBER")
pnpm tauri android build --ci --apk --split-per-abi --target "$ANDROID_TARGET" --config "$config"
record_stage "$stage"

# Gradle tasks can overlap. Show their individual durations alongside the wall time.
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  reports=("$android_project"/build/reports/profile/profile-*.html)
  profile=${reports[${#reports[@]}-1]}
  if [[ -f "$profile" ]]; then
    printf '\n| Gradle task | Duration | Outcome |\n| --- | ---: | --- |\n' >> "$GITHUB_STEP_SUMMARY"
    awk '
      /class="indentPath">/ && /:(minify.*WithR8|lintVitalAnalyze.*|compile.*ReleaseKotlin|package[^<]*Release|rustBuild.*Release)</ {
        task = $0; sub(/^.*indentPath">/, "", task); sub(/<.*/, "", task)
        getline; duration = $0; sub(/^.*numeric">/, "", duration); sub(/<.*/, "", duration)
        getline; sub(/^.*<td>/, ""); sub(/<.*/, "")
        printf "| %s | %s | %s |\n", task, duration, ($0 == "" ? "Executed" : $0)
      }
    ' "$profile" | tee -a "$GITHUB_STEP_SUMMARY"
  fi
fi
