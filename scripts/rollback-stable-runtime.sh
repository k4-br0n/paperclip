#!/usr/bin/env bash
set -euo pipefail

CURRENT_LINK="${PAPERCLIP_CURRENT_LINK:-/home/jorge/dev/paperclip-current}"
RELEASES_ROOT="${PAPERCLIP_RELEASES_ROOT:-/home/jorge/dev/paperclip-releases}"
SERVICE_NAME="${PAPERCLIP_SERVICE_NAME:-paperclip-stable-main.service}"
TARGET="${1:-}"

if [ -z "$TARGET" ]; then
  mapfile -t releases < <(find "$RELEASES_ROOT" -mindepth 1 -maxdepth 1 -type d | sort)
  if [ "${#releases[@]}" -lt 2 ]; then
    echo "Need at least two releases to rollback." >&2
    exit 1
  fi
  TARGET="${releases[$((${#releases[@]} - 2))]}/runtime"
fi

if [ ! -d "$TARGET" ]; then
  echo "Rollback target does not exist: $TARGET" >&2
  exit 1
fi

ln -sfn "$TARGET" "$CURRENT_LINK"
systemctl --user daemon-reload
systemctl --user restart "$SERVICE_NAME"
sleep 5
curl --silent --show-error --fail --max-time 10 http://127.0.0.1:3213/api/health >/dev/null
printf 'rolled back to %s\n' "$(readlink -f "$CURRENT_LINK")"
