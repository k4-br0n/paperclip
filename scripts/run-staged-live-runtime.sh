#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/jorge/.local/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/home/jorge/.local/share/pnpm:/usr/bin:/bin:/home/jorge/.npm-global/bin:/home/jorge/bin:/home/jorge/.volta/bin:/home/jorge/.asdf/shims:/home/jorge/.bun/bin:/home/jorge/.nvm/current/bin:/home/jorge/.fnm/current/bin:/snap/bin:${PATH:-}"

RUNTIME_ROOT="/home/jorge/dev/paperclip-live-runtime"
cd "$RUNTIME_ROOT"

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3112}"
export HOST="${HOST:-127.0.0.1}"
export PAPERCLIP_HOME="${PAPERCLIP_HOME:-/home/jorge/dev/paperclip-dev-home}"
export PAPERCLIP_UI_DEV_MIDDLEWARE="false"
export PAPERCLIP_MIGRATION_PROMPT="never"
export PAPERCLIP_MIGRATION_AUTO_APPLY="true"

exec node server/dist/index.js
