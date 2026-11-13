"""Select the Rust library format for a disposable release checkout.

Run from the checkout root: python .github/packages/release-library.py windows
Use android for a JNI shared library, or windows for the executable's Rust library.
"""
import argparse
import re
from pathlib import Path


def main():
    formats = {"android": "cdylib", "windows": "rlib"}
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("platform", choices=formats)
    selected = formats[parser.parse_args().platform]
    manifest = Path("src-tauri/Cargo.toml")
    source = manifest.read_bytes()
    section = re.search(rb"(?ms)^\[lib\]\r?\n(.*?)(?=^\[|\Z)", source)
    if not section:
        raise SystemExit("Missing [lib] in Cargo.toml")
    declaration = re.search(rb'(?m)^crate-type[ \t]*=[ \t]*\[([^\]\n]*)\]', section[1])
    if not declaration or selected.encode() not in re.findall(rb'"([^"]+)"', declaration[1]):
        raise SystemExit(f"Cargo.toml does not declare the required {selected} output")
    start = section.start(1) + declaration.start(1)
    end = section.start(1) + declaration.end(1)
    manifest.write_bytes(source[:start] + f'"{selected}"'.encode() + source[end:])


if __name__ == "__main__":
    main()
