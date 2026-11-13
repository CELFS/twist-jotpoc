#!/usr/bin/env bash
# Build this platform on its release runner: bash .github/packages/linux.sh
set -euo pipefail
pnpm tauri bundle --bundles deb
