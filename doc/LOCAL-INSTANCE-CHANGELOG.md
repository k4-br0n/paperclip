# Local Instance Changelog

This file tracks **instance-affecting local operational changes** for Jorge's live repo-backed Paperclip setup.

Use it for changes such as:

- service names or behavior
- ports or bind mode
- dedicated Paperclip home/config paths
- launcher/runtime changes
- build/prepare workflow changes
- rollback procedure changes
- local-only runtime fixes needed to keep the fork live

Do **not** use this as a general product changelog. This is for the operational reality of the local live instance.

---

## 2026-03-24 — Repo-first local main instance cutover

### Added
- Repo-local instance documentation:
  - `doc/LOCAL-INSTANCE-JORGE.md`
  - `doc/LOCAL-LIVE-RUNBOOK.md`
  - `doc/LOCAL-INSTANCE-CHANGELOG.md`
- Repo runtime/ops scripts:
  - `scripts/prepare-repo-main.sh`
  - `scripts/run-repo-main.sh`
  - `scripts/setup-repo-runtime-node-path.mjs`
  - `scripts/rollback-to-npm-paperclip.sh`
- Persistent user service:
  - `~/.config/systemd/user/paperclip-dev-main.service`

### Changed
- The active local main Paperclip instance now runs directly from repo-built artifacts in `/home/jorge/dev/paperclip-dev`.
- The dedicated instance home/config for this live fork is:
  - `/home/jorge/dev/paperclip-dev-home`
- Live runtime now uses:
  - `server/dist/index.js`
  - built static UI in `server/ui-dist`
  - an isolated `.repo-runtime/node_modules` overlay so runtime package resolution targets built workspace `dist` outputs instead of source TS exports

### Fixed
- Resolved repo-first runtime blocker where plain Node startup from `server/dist/index.js` could resolve workspace packages into `src/*.ts` export surfaces.
- Restored recursive repo build by updating adapter skill typing so OpenClaw gateway skill entries can carry `scope`:
  - `packages/adapter-utils/src/types.ts`

### Operational Rule
- The persistent service is intentionally **not auto-building**.
- Repo edits do **not** automatically become live in the daily-driver instance.
- After repo code changes, the required flow is:

```bash
cd /home/jorge/dev/paperclip-dev
./scripts/prepare-repo-main.sh
systemctl --user restart paperclip-dev-main.service
```

### Rollback
- Legacy fallback remains:

```bash
cd /home/jorge/dev/paperclip-dev
./scripts/rollback-to-npm-paperclip.sh
```

- Under the hood, rollback returns to:

```bash
paperclipai run -d /home/jorge/.paperclip
```

### Hardening Follow-up
- Added supervised launcher:
  - `scripts/run-repo-main-supervised.sh`
- Updated `paperclip-dev-main.service` to use the supervised launcher instead of calling `run-repo-main.sh` directly.
- Service policy now uses more aggressive restart behavior so unhealthy half-alive states recover automatically.
- Supervisor behavior:
  - waits for startup health success on `/api/health`
  - performs periodic health checks
  - terminates the child process after repeated health failures so `systemd` restarts the stack cleanly

### Documentation Follow-up
- Explicitly documented the split between:
  - live daily-driver instance
  - separate dev/sandbox instance
- Documented that the live embedded Postgres database is persistent on disk and should be treated as real state.
- Documented the recommended promotion flow from dev work into the live instance.

### Promotion Failure / Recovery Lesson
- A successful dev instance did **not** guarantee a promotion-ready repo state.
- Root cause: the OpenClaw skills/provisioning phase was split across committed files, working-tree changes, `stash@{0}`, and the stash untracked-files object.
- Result: the live repo-backed build initially missed parity even though the feature looked correct in the dev instance.
- Recovery required:
  - auditing tracker claims against current source
  - recovering missing files/edits from stash
  - restoring adapter export/registry wiring
  - rebuilding and re-promoting the consolidated repo state
- Durable rule: do not treat "works in dev" as sufficient evidence of live-readiness.
- New project guardrail added:
  - `doc/PROMOTION-CHECKLIST.md`

### Notes
- This cutover deliberately chose the **repo-first local-live runtime** lane instead of continuing package-first/tarball/release hardening.
- Packaging improvements made earlier the same day may still be useful, but they are not the canonical path for Jorge's live local instance.
