#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"
DATA_DIR="$SCRIPT_DIR/data"
SYSTEM_DIR="$SCRIPT_DIR/system"

GATEWAY_PORT=18789
UI_PORT=3210

log() { echo "[PocketClaw] $*"; }
error() { echo "[PocketClaw ERROR] $*" >&2; }

detect_node() {
    local arch="$(uname -m)"
    if [ "$arch" = "arm64" ]; then
        NODE_BIN="$APP_DIR/runtime/node-darwin-arm64/bin/node"
    else
        NODE_BIN="$APP_DIR/runtime/node-darwin-x64/bin/node"
    fi

    if [ ! -f "$NODE_BIN" ]; then
        error "Node.js not found. Please run setup first:"
        error "  cd $SYSTEM_DIR && bash setup.sh"
        exit 1
    fi

    export PATH="$(dirname "$NODE_BIN"):$PATH"
}

check_openclaw() {
    local openclaw_bin="$APP_DIR/core/node_modules/.bin/openclaw"
    if [ ! -f "$openclaw_bin" ]; then
        error "OpenClaw not found. Please run setup first:"
        error "  cd $SYSTEM_DIR && bash setup.sh"
        exit 1
    fi
}

cleanup() {
    log "Shutting down..."
    [ -n "${GATEWAY_PID:-}" ] && kill "$GATEWAY_PID" 2>/dev/null
    [ -n "${UI_PID:-}" ] && kill "$UI_PID" 2>/dev/null
    wait 2>/dev/null
    log "Goodbye!"
}
trap cleanup EXIT INT TERM

start_gateway() {
    log "Starting OpenClaw Gateway on port $GATEWAY_PORT..."
    export OPENCLAW_HOME="$DATA_DIR/.openclaw"

    local openclaw_bin="$APP_DIR/core/node_modules/.bin/openclaw"
    "$openclaw_bin" gateway --port "$GATEWAY_PORT" &
    GATEWAY_PID=$!

    local retries=0
    while ! curl -sf "http://127.0.0.1:$GATEWAY_PORT/health" >/dev/null 2>&1; do
        retries=$((retries + 1))
        if [ $retries -gt 30 ]; then
            error "Gateway failed to start within 30 seconds"
            exit 1
        fi
        sleep 1
    done
    log "Gateway started (PID: $GATEWAY_PID)"
}

start_ui() {
    log "Starting PocketClaw UI on port $UI_PORT..."
    "$NODE_BIN" "$SYSTEM_DIR/server.js" &
    UI_PID=$!
    sleep 1
    log "UI server started (PID: $UI_PID)"
}

main() {
    log "=== PocketClaw ==="
    log "Version: $(cat "$SCRIPT_DIR/version.txt" 2>/dev/null || echo 'unknown')"

    detect_node
    check_openclaw
    start_gateway
    start_ui

    log "Opening browser..."
    open "http://localhost:$UI_PORT"

    log "PocketClaw is running!"
    log "  UI:      http://localhost:$UI_PORT"
    log "  Gateway: http://localhost:$GATEWAY_PORT"
    log "Press Ctrl+C to stop"

    wait
}

main "$@"
