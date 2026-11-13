#!/usr/bin/env bash
# Build this platform on its release runner: bash .github/packages/linux.sh
set -euo pipefail
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev libxdo-dev libdbus-1-dev
pnpm tauri build --bundles deb
