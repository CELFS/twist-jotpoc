#!/usr/bin/env bash
# Build this platform on its release runner: bash .github/packages/macos.sh
set -euo pipefail
rustup target add x86_64-apple-darwin aarch64-apple-darwin
pnpm tauri build --target universal-apple-darwin --bundles dmg
