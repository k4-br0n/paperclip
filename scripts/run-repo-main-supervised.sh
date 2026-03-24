#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/jorge/.local/bin:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/home/jorge/.local/share/pnpm:/usr/bin:/bin:/home/jorge/.npm-global/bin:/home/jorge/bin:/home/jorge/.volta/bin:/home/jorge/.asdf/shims:/home/jorge/.bun/bin:/home/jorge/.nvm/current/bin:/home/jorge/.fnm/current/bin:/snap/bin:${PATH:-}"

REPO_ROOT="/home/jorge/dev/paperclip-dev"
cd "$REPO_ROOT"

PORT="${PORT:-3110}"
HOST="${HOST:-127.0.0.1}"
HEALTH_URL="http://${HOST}:${PORT}/api/health"
STARTUP_TIMEOUT_SECONDS="${PAPERCLIP_STARTUP_TIMEOUT_SECONDS:-90}"
HEALTHCHECK_INTERVAL_SECONDS="${PAPERCLIP_HEALTHCHECK_INTERVAL_SECONDS:-20}"
HEALTHCHECK_FAILURE_THRESHOLD="${PAPERCLIP_HEALTHCHECK_FAILURE_THRESHOLD:-3}"
CURL_BIN="$(command -v curl)"

cleanup() {
  if [[ -n "${CHILD_PID:-}" ]] && kill -0 "$CHILD_PID" 2>/dev/null; then
    kill "$CHILD_PID" 2>/dev/null || true
    wait "$CHILD_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

"$REPO_ROOT/scripts/run-repo-main.sh" &
CHILD_PID=$!

startup_deadline=$(( $(date +%s) + STARTUP_TIMEOUT_SECONDS ))
while true; do
  if ! kill -0 "$CHILD_PID" 2>/dev/null; then
    wait "$CHILD_PID"
    exit $?
  fi

  if "$CURL_BIN" --silent --show-error --fail --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "paperclip supervisor: healthcheck passed at startup ($HEALTH_URL)"
    break
  fi

  if (( $(date +%s) >= startup_deadline )); then
    echo "paperclip supervisor: startup healthcheck timed out ($HEALTH_URL)" >&2
    kill "$CHILD_PID" 2>/dev/null || true
    wait "$CHILD_PID" 2>/dev/null || true
    exit 1
  fi

  sleep 2
done

consecutive_failures=0
while true; do
  if ! kill -0 "$CHILD_PID" 2>/dev/null; then
    wait "$CHILD_PID"
    exit $?
  fi

  if "$CURL_BIN" --silent --show-error --fail --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    consecutive_failures=0
  else
    consecutive_failures=$((consecutive_failures + 1))
    echo "paperclip supervisor: healthcheck failed ${consecutive_failures}/${HEALTHCHECK_FAILURE_THRESHOLD} ($HEALTH_URL)" >&2
    if (( consecutive_failures >= HEALTHCHECK_FAILURE_THRESHOLD )); then
      echo "paperclip supervisor: unhealthy service detected, terminating child for systemd restart" >&2
      kill "$CHILD_PID" 2>/dev/null || true
      wait "$CHILD_PID" 2>/dev/null || true
      exit 1
    fi
  fi

  sleep "$HEALTHCHECK_INTERVAL_SECONDS"
done
