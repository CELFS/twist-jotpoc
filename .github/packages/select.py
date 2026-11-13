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


def affected(path):
    if path in {"README.md", "CHANGELOG.md"} or path.startswith("docs/"):
        return set()
    if path.startswith(("src-tauri/gen/android/", "src-tauri/icons/android/")) or path == ".github/packages/android-sign.sh":
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
    print(json.dumps([{"platform": p, "os": os, "asset": asset}
                      for p, (os, asset) in TARGETS.items() if p in selected]))
