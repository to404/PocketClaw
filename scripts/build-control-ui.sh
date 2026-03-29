#!/usr/bin/env bash
# Build OpenClaw gateway Control UI (port 18789) into portable/dist/control-ui/.
# The npm openclaw package does not ship these assets; release CI runs the same flow.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PKG_JSON="$ROOT/portable/app/core/node_modules/openclaw/package.json"
DEST="$ROOT/portable/dist/control-ui"
TMP="${TMPDIR:-/tmp}/openclaw-src-$$"

log() { echo "[build-control-ui] $*"; }

if [[ ! -f "$PKG_JSON" ]]; then
  echo "[build-control-ui] ERROR: OpenClaw not found at $PKG_JSON" >&2
  echo "Run portable/system/setup.sh openclaw or setup.bat openclaw first." >&2
  exit 1
fi

VER="$(node -e "console.log(require('$PKG_JSON').version)")"
log "OpenClaw package version: $VER"

rm -rf "$TMP"
mkdir -p "$TMP"

if ! git clone --depth 1 --branch "v${VER}" https://github.com/openclaw/openclaw.git "$TMP/src" 2>/dev/null; then
  log "Branch v${VER} not found, cloning default branch..."
  git clone --depth 1 https://github.com/openclaw/openclaw.git "$TMP/src"
fi

cd "$TMP/src"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
node scripts/ui.js build 2>/dev/null || pnpm ui:build || true

if [[ ! -f "dist/control-ui/index.html" ]]; then
  echo "[build-control-ui] ERROR: Build did not produce dist/control-ui/index.html" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"
cp -R dist/control-ui/* "$DEST/"
log "Copied Control UI to $DEST"
cd "$ROOT"
rm -rf "$TMP"
