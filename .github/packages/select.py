"""Select release runners. Usage: python3 .github/packages/select.py BEFORE AFTER [PLATFORM]."""
import json
import subprocess
import sys

TARGETS = {
    "macos": ("macos-15", "src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg"),
    "windows": ("windows-2022", "src-tauri/target/release/bundle/nsis/*.exe"),
    "linux": ("ubuntu-24.04", "src-tauri/target/release/bundle/deb/*.deb"),
    "android": ("ubuntu-24.04", "packages/JotPoc.apk"),
}


# Tauri CLI target, Rust target and APK ABI directory for each runner.
ANDROID = {
    "arm64-v8a": ("aarch64", "aarch64-linux-android"),
    "armeabi-v7a": ("armv7", "armv7-linux-androideabi"),
    "x86": ("i686", "i686-linux-android"),
    "x86_64": ("x86_64", "x86_64-linux-android"),
}


def runners(selected):
    for platform, (os, asset) in TARGETS.items():
        if platform == "android":
            for abi, (target, rust_target) in ANDROID.items():
                package = f"android-{abi}"
                if platform in selected or package in selected:
                    yield dict(platform=platform, os=os, asset=asset, package=package,
                               abi=abi, target=target, rust_target=rust_target)
        elif platform in selected:
            yield dict(platform=platform, os=os, asset=asset, package=platform,
                       abi="", target="", rust_target="")


def affected(path):
    if path in {"README.md", "CHANGELOG.md"} or path.startswith("docs/"):
        return set()
    if path == ".github/packages/linux-deps.sh":
        return {"linux"}
    if path == ".github/packages/release-library.py":
        return {"android", "windows"}
    if path.startswith(("src-tauri/gen/android/", "src-tauri/icons/android/", ".github/actions/android-ndk/")) or path in {
        ".github/packages/android-gradle.sh", ".github/packages/android-sign.sh", ".github/packages/android-ndk-version", ".github/packages/android-timings.py",
    }:
        return {"android"}
    for platform in TARGETS:
        if path in {f".github/packages/{platform}.sh", f"src-tauri/tauri.{platform}.conf.json"}:
            return {platform}
    return set(TARGETS)


def select(before, after, manual):
    if manual:
        return set(TARGETS) if manual == "all" else {manual}
    if not before or not before.strip("0"):
        return set(TARGETS)
    diff = subprocess.run(
        ["git", "diff", "--no-renames", "--name-only", "-z", before, after, "--"],
        capture_output=True,
    )
    if diff.returncode:
        return set(TARGETS)
    selected = set()
    for path in diff.stdout.split(b"\0"):
        if path:
            selected.update(affected(path.decode(errors="surrogateescape")))
    return selected


if __name__ == "__main__":
    selected = select(*sys.argv[1:])
    print(json.dumps(list(runners(selected))))
