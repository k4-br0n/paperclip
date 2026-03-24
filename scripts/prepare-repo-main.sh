#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/jorge/.local/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/home/jorge/.local/share/pnpm:/usr/bin:/bin:/home/jorge/.npm-global/bin:/home/jorge/bin:/home/jorge/.volta/bin:/home/jorge/.asdf/shims:/home/jorge/.bun/bin:/home/jorge/.nvm/current/bin:/home/jorge/.fnm/current/bin:/snap/bin:${PATH:-}"

REPO_ROOT="/home/jorge/dev/paperclip-dev"
cd "$REPO_ROOT"

npx --yes pnpm@9.15.4 --dir "$REPO_ROOT" -r build
bash "$REPO_ROOT/scripts/prepare-server-ui-dist.sh"
