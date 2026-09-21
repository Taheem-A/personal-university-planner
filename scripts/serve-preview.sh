#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
node scripts/serve-static.mjs prototypes/approved-preview "${PORT:-4173}"
