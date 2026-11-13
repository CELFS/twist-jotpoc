#!/usr/bin/env bash
# Build this platform on its release runner: bash .github/packages/windows.sh
set -euo pipefail
pnpm tauri build --bundles nsis
