# Staged Live Runtime Task Tracker

## Objective

Create a proper split between:
- dev repo (`/home/jorge/dev/paperclip-dev`)
- staged live runtime (new directory)
- persistent live state (`/home/jorge/dev/paperclip-dev-home`)

## Phase 1 — Runtime split design
- [x] Confirm current pain point: repo-backed live runtime still relies on runtime export rewriting for Node ESM safety
- [x] Choose staged runtime directory path (`/home/jorge/dev/paperclip-live-runtime`)
- [x] Build first assembly prototype (copy-based staged runtime with rewritten dist exports)
- [ ] Decide final assembly model (copy vs symlink vs hybrid)
- [x] Define runtime contents checklist (server dist, ui-dist, built workspace package surfaces, runtime metadata)
- [ ] Define rollback path for staged runtime deploys

## Phase 2 — Staging implementation
- [x] Implement runtime assembly script
- [x] Implement staged deploy script
- [x] Build first staged runtime from current `k4br0n/live`
- [x] Verify staged runtime contains server entrypoint + current UI assets
- [ ] Prototype 2: preserve `server/node_modules` dependency surface inside staged runtime
- [ ] Verify staged runtime package/runtime resolution works without live repo export mutation

## Phase 3 — Service cutover
- [ ] Retarget `paperclip-dev-main.service` to staged runtime
- [ ] Restart and verify health
- [ ] Verify live HTML references correct asset hash
- [ ] Verify JS asset returns correct MIME
- [ ] Verify DB/home/state unchanged

## Phase 4 — Update flows and docs
- [ ] Document deploy flow from repo → staged runtime
- [ ] Document upstream sync flow (`master` → `k4br0n/live` → staged deploy)
- [ ] Document branch/update expectations in project docs
- [ ] Record final operating commands

## Working Notes
- Keep old stash intact until Jorge says otherwise.
- Do not disturb persistent live home at `/home/jorge/dev/paperclip-dev-home`.
- Current stopgap remains usable while staged runtime is being built.

## Active Debugging — 2026-03-27
- Private repo: `k4-br0n/paperclip-dev-private`
- Private issues for this phase:
  - `k4-br0n/paperclip-dev-private#1` — staged stable runtime exits cleanly under `systemd` after startup
  - `k4-br0n/paperclip-dev-private#2` — embedded Postgres recovery can leave web runtime up against dead DB port
- Current focus: debug/fix in dev repo first; leave live instance alone until root cause is actually solved
- Latest confirmed finding:
  - historical repro in private issue `#1` is now narrowed to Node main-module path form under service/systemd context, not just symlink vs non-symlink cwd
  - reproduced on 2026-03-27:
    - `cd /home/jorge/dev/paperclip-current && exec /usr/bin/node server/dist/index.js` stays alive under `systemd-run --user`
    - `exec /usr/bin/node /home/jorge/dev/paperclip-current/server/dist/index.js` exits cleanly after ~2s under the same class of context
  - `/home/jorge/dev/paperclip-current` currently resolves to `/home/jorge/dev/paperclip-releases/manual-seed/runtime`, not `/home/jorge/dev/paperclip-stable-runtime`
  - current fix direction: always `cd` into the runtime/repo root first, then launch Node with relative `server/dist/index.js`
  - sweep completed for repo launchers involved in local/staged/runtime service flows:
    - fixed `scripts/run-current-stable-runtime-supervised.sh`
    - fixed `scripts/systemd-paperclip-main.sh`
    - fixed `scripts/run-staged-live-runtime-supervised.sh`
    - fixed `scripts/run-staged-live-runtime.sh`
    - fixed `scripts/run-repo-main.sh`
- Rule for this phase: capture findings in repo + private GitHub first, commit meaningful debugging steps as we go
- Promotion rule:
  1. private repo = active debugging / messy work / private issues
  2. public fork (`k4-br0n/paperclip`) = promotion target only once work is coherent
  3. upstream (`paperclipai/paperclip`) = confirmed product bugs/fixes only after proof they are not Jorge/fork-specific
