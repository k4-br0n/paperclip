#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/jorge/bin:${PATH:-}"
RUNTIME_ROOT="${PAPERCLIP_CURRENT_LINK:-/home/jorge/dev/paperclip-current}"
cd "$RUNTIME_ROOT"
export PAPERCLIP_HOME="${PAPERCLIP_HOME:-/home/jorge/dev/paperclip-stable-home}"
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3213}"
export HOST="${HOST:-127.0.0.1}"
export PAPERCLIP_UI_DEV_MIDDLEWARE="false"
export PAPERCLIP_MIGRATION_PROMPT="never"
export PAPERCLIP_MIGRATION_AUTO_APPLY="true"
NODE_BIN="$(command -v node || true)"
printf 'wrapper-start pid=%s ppid=%s shell=%s cwd=%s runtime=%s node=%s\n' "$$" "$PPID" "$0" "$PWD" "$RUNTIME_ROOT" "$NODE_BIN" >&2
printf 'wrapper-env HOST=%s PORT=%s PAPERCLIP_HOME=%s NODE_ENV=%s\n' "$HOST" "$PORT" "$PAPERCLIP_HOME" "$NODE_ENV" >&2
printf 'wrapper-launch about to exec node entry=%s\n' "$RUNTIME_ROOT/server/dist/index.js" >&2
exec "$NODE_BIN" server/dist/index.js
printf 'wrapper-after-exec should-never-print\n' >&2
