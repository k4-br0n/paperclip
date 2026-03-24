#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/jorge/.local/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/home/jorge/.local/share/pnpm:/usr/bin:/bin:/home/jorge/.npm-global/bin:/home/jorge/bin:/home/jorge/.volta/bin:/home/jorge/.asdf/shims:/home/jorge/.bun/bin:/home/jorge/.nvm/current/bin:/home/jorge/.fnm/current/bin:/snap/bin:${PATH:-}"

REPO_ROOT="/home/jorge/dev/paperclip-dev"
cd "$REPO_ROOT"

if [ -f .env.devlocal ]; then
  set -a
  . ./.env.devlocal
  set +a
fi

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3111}"
export HOST="${HOST:-127.0.0.1}"
export PAPERCLIP_HOME="${PAPERCLIP_HOME:-/home/jorge/dev/paperclip-dev-home}"
export PAPERCLIP_UI_DEV_MIDDLEWARE="false"
export PAPERCLIP_MIGRATION_PROMPT="never"
export PAPERCLIP_MIGRATION_AUTO_APPLY="true"

if [ ! -f "$REPO_ROOT/server/dist/index.js" ] || [ ! -f "$REPO_ROOT/server/ui-dist/index.html" ]; then
  npx --yes pnpm@9.15.4 --dir "$REPO_ROOT" -r build
  bash "$REPO_ROOT/scripts/prepare-server-ui-dist.sh"
fi

RUNTIME_NODE_MODULES="$(node "$REPO_ROOT/scripts/setup-repo-runtime-node-path.mjs")/node_modules"
export NODE_PATH="$RUNTIME_NODE_MODULES${NODE_PATH:+:$NODE_PATH}"

exec node "$REPO_ROOT/server/dist/index.js"
