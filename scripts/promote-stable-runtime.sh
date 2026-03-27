#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/jorge/.local/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/home/jorge/.local/share/pnpm:/usr/bin:/bin:/home/jorge/.npm-global/bin:/home/jorge/bin:/home/jorge/.volta/bin:/home/jorge/.asdf/shims:/home/jorge/.bun/bin:/home/jorge/.nvm/current/bin:/home/jorge/.fnm/current/bin:/snap/bin:${PATH:-}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_ROOT="${PAPERCLIP_SOURCE_ROOT:-$REPO_ROOT}"
RELEASES_ROOT="${PAPERCLIP_RELEASES_ROOT:-/home/jorge/dev/paperclip-releases}"
CURRENT_LINK="${PAPERCLIP_CURRENT_LINK:-/home/jorge/dev/paperclip-current}"
STABLE_HOME="${PAPERCLIP_STABLE_HOME:-/home/jorge/dev/paperclip-stable-home}"
SERVICE_NAME="${PAPERCLIP_SERVICE_NAME:-paperclip-stable-main.service}"
SMOKE_PORT="${PAPERCLIP_SMOKE_PORT:-3220}"
SMOKE_HOST="${PAPERCLIP_SMOKE_HOST:-127.0.0.1}"
INSTANCE_ID="${PAPERCLIP_INSTANCE_ID:-default}"
BACKUP_ROOT_DEFAULT="$STABLE_HOME/backups/pre-release/$INSTANCE_ID"
BACKUP_ROOT="${PAPERCLIP_BACKUP_ROOT:-$BACKUP_ROOT_DEFAULT}"
RELEASE_ID="${1:-$(date -u +%Y-%m-%d-%H%M%S)}"
RELEASE_DIR="$RELEASES_ROOT/$RELEASE_ID"
RUNTIME_DIR="$RELEASE_DIR/runtime"
PREV_TARGET=""

mkdir -p "$RELEASES_ROOT" "$STABLE_HOME" "$BACKUP_ROOT"
if [ -L "$CURRENT_LINK" ]; then
  PREV_TARGET="$(readlink -f "$CURRENT_LINK")"
fi

log() {
  printf '[promote-stable-runtime] %s\n' "$*"
}

require_bin() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required binary: $1" >&2
    exit 1
  }
}

require_bin pnpm
require_bin node
require_bin curl
require_bin systemctl
require_bin rsync
require_bin tar

log "building source repo from $SOURCE_ROOT"
cd "$SOURCE_ROOT"
pnpm install --frozen-lockfile
pnpm build
bash scripts/prepare-server-ui-dist.sh

log "assembling runtime to $RUNTIME_DIR"
rm -rf "$RELEASE_DIR"
mkdir -p "$RUNTIME_DIR"
PAPERCLIP_RUNTIME_ROOT="$RUNTIME_DIR" node scripts/assemble-staged-runtime.mjs >/dev/null

log "installing production dependencies in assembled runtime"
cd "$RUNTIME_DIR"
CI=1 pnpm install --prod --frozen-lockfile --force >/dev/null

log "smoke testing release on $SMOKE_HOST:$SMOKE_PORT"
SMOKE_HOME="$RELEASE_DIR/smoke-home"
rm -rf "$SMOKE_HOME"
mkdir -p "$SMOKE_HOME"
PORT="$SMOKE_PORT" HOST="$SMOKE_HOST" PAPERCLIP_HOME="$SMOKE_HOME" timeout 90s bash "$SOURCE_ROOT/scripts/run-staged-live-runtime-supervised.sh" >/tmp/paperclip-smoke-$RELEASE_ID.log 2>&1 &
SMOKE_PID=$!
cleanup_smoke() {
  if kill -0 "$SMOKE_PID" 2>/dev/null; then
    kill "$SMOKE_PID" 2>/dev/null || true
    wait "$SMOKE_PID" 2>/dev/null || true
  fi
}
trap cleanup_smoke EXIT INT TERM
for _ in $(seq 1 45); do
  if curl --silent --show-error --fail --max-time 5 "http://$SMOKE_HOST:$SMOKE_PORT/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
curl --silent --show-error --fail --max-time 5 "http://$SMOKE_HOST:$SMOKE_PORT/api/health" >/dev/null
cleanup_smoke
trap - EXIT INT TERM

if [ -d "$STABLE_HOME/instances/$INSTANCE_ID" ]; then
  BACKUP_FILE="$BACKUP_ROOT/${RELEASE_ID}.tar.gz"
  log "backing up current stable home to $BACKUP_FILE"
  tar -C "$STABLE_HOME" -czf "$BACKUP_FILE" "instances/$INSTANCE_ID"
fi

log "promoting release via symlink switch"
ln -sfn "$RUNTIME_DIR" "$CURRENT_LINK"

log "restarting stable service $SERVICE_NAME"
systemctl --user daemon-reload
systemctl --user restart "$SERVICE_NAME"
for _ in $(seq 1 45); do
  if curl --silent --show-error --fail --max-time 5 "http://127.0.0.1:3213/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
if ! curl --silent --show-error --fail --max-time 5 "http://127.0.0.1:3213/api/health" >/dev/null; then
  echo "promotion failed healthcheck; attempting rollback" >&2
  if [ -n "$PREV_TARGET" ]; then
    ln -sfn "$PREV_TARGET" "$CURRENT_LINK"
    systemctl --user restart "$SERVICE_NAME" || true
  fi
  exit 1
fi

log "promotion complete"
log "current -> $(readlink -f "$CURRENT_LINK")"
log "health -> http://127.0.0.1:3213/api/health"
