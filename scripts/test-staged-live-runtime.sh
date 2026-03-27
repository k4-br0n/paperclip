#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/jorge/.local/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/home/jorge/.local/share/pnpm:/usr/bin:/bin:/home/jorge/.npm-global/bin:/home/jorge/bin:/home/jorge/.volta/bin:/home/jorge/.asdf/shims:/home/jorge/.bun/bin:/home/jorge/.nvm/current/bin:/home/jorge/.fnm/current/bin:/snap/bin:${PATH:-}"

REPO_ROOT="/home/jorge/dev/paperclip-dev"
RUNTIME_ROOT="/home/jorge/dev/paperclip-live-runtime"
BASE_URL="http://127.0.0.1:3112"
HEALTH_URL="$BASE_URL/api/health"
LOG_FILE="/tmp/paperclip-staged-runtime-test.log"
PID_FILE="/tmp/paperclip-staged-runtime-test.pid"

cd "$REPO_ROOT"
node ./scripts/assemble-staged-runtime.mjs >/dev/null
cd "$RUNTIME_ROOT"
export PATH="/home/jorge/bin:${PATH:-}"
CI=1 pnpm install --prod --frozen-lockfile --force >/dev/null
cd "$REPO_ROOT"

PORT=3112 PAPERCLIP_HOME=/home/jorge/dev/paperclip-dev-home nohup "$REPO_ROOT/scripts/run-staged-live-runtime.sh" > "$LOG_FILE" 2>&1 & echo $! > "$PID_FILE"
PID="$(cat "$PID_FILE")"
cleanup() {
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 45); do
  if curl --silent --show-error --fail --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

curl --silent --show-error --fail --max-time 5 "$HEALTH_URL" >/dev/null
index_html="$(curl --silent --show-error --fail --max-time 10 "$BASE_URL/")"
asset_path="$(printf '%s' "$index_html" | grep -o 'assets/[^"]*\.js' | head -n 1 || true)"
if [[ -z "$asset_path" ]]; then
  echo "staged runtime test failed: missing JS asset reference" >&2
  exit 1
fi
asset_headers="$(curl -I --silent --show-error --fail --max-time 10 "$BASE_URL/$asset_path")"
if ! printf '%s' "$asset_headers" | grep -qi '^Content-Type: text/javascript'; then
  echo "staged runtime test failed: asset did not return JavaScript MIME" >&2
  printf '%s\n' "$asset_headers" >&2
  exit 1
fi

echo "staged runtime test verified"
echo "health: $HEALTH_URL"
echo "asset: $BASE_URL/$asset_path"
