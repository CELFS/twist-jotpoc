#!/usr/bin/env bash
# Install Linux release prerequisites: bash .github/packages/linux-deps.sh
set -euo pipefail
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev libxdo-dev libdbus-1-dev
