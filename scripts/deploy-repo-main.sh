#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/jorge/.local/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/home/jorge/.local/share/pnpm:/usr/bin:/bin:/home/jorge/.npm-global/bin:/home/jorge/bin:/home/jorge/.volta/bin:/home/jorge/.asdf/shims:/home/jorge/.bun/bin:/home/jorge/.nvm/current/bin:/home/jorge/.fnm/current/bin:/snap/bin:${PATH:-}"

REPO_ROOT="/home/jorge/dev/paperclip-dev"
SERVICE_NAME="paperclip-dev-main.service"
BASE_URL="http://127.0.0.1:3110"
HEALTH_URL="$BASE_URL/api/health"

cd "$REPO_ROOT"

./scripts/prepare-repo-main.sh
systemctl --user restart "$SERVICE_NAME"

for _ in $(seq 1 30); do
  if curl --silent --show-error --fail --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

curl --silent --show-error --fail --max-time 5 "$HEALTH_URL" >/dev/null

index_html="$(curl --silent --show-error --fail --max-time 10 "$BASE_URL/")"
asset_path="$(printf '%s' "$index_html" | grep -o 'assets/[^"]*\.js' | head -n 1 || true)"

if [[ -z "$asset_path" ]]; then
  echo "deploy verification failed: could not extract JS asset path from live HTML" >&2
  exit 1
fi

asset_headers="$(curl -I --silent --show-error --fail --max-time 10 "$BASE_URL/$asset_path")"
if ! printf '%s' "$asset_headers" | grep -qi '^Content-Type: text/javascript'; then
  echo "deploy verification failed: live asset $asset_path did not return JavaScript MIME type" >&2
  printf '%s\n' "$asset_headers" >&2
  exit 1
fi

echo "deploy verified"
echo "health: $HEALTH_URL"
echo "asset: $BASE_URL/$asset_path"
