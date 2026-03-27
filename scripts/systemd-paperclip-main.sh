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
exec node server/dist/index.js
