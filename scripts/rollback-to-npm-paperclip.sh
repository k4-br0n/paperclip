#!/usr/bin/env bash
set -euo pipefail

systemctl --user stop paperclip-dev-main.service || true
systemctl --user disable paperclip-dev-main.service || true
systemctl --user daemon-reload

exec paperclipai run -d /home/jorge/.paperclip
