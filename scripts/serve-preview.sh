#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
python3 -m http.server "${PORT:-4173}" --directory preview
