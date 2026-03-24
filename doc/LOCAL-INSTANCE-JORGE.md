# Jorge Local Instance Operations

This document is the repo-local source of truth for Jorge's main local Paperclip instance.

## Purpose

This repo checkout is not just a dev sandbox. It is Jorge's active local main Paperclip instance, running directly from the repo in built/non-watch mode.

Goals of this setup:

- run Paperclip directly from `/home/jorge/dev/paperclip-dev`
- keep the repo editable for ongoing development
- avoid the dev harness/watch-mode path for the live instance
- avoid package-first/tarball/npm-release flow for day-to-day local use
- preserve clean rollback to the legacy npm-installed instance

## Canonical Instance Paths

| Item | Path |
|---|---|
| Repo | `/home/jorge/dev/paperclip-dev` |
| Live Paperclip home | `/home/jorge/dev/paperclip-dev-home` |
| Live embedded Postgres data dir | `/home/jorge/dev/paperclip-dev-home/instances/default/db` |
| User service | `~/.config/systemd/user/paperclip-dev-main.service` |
| Legacy rollback instance | `paperclipai run -d /home/jorge/.paperclip` |
| Recommended separate dev home | `/home/jorge/dev/paperclip-dev-sandbox` |

## Runtime Model

The live local instance runs from built repo artifacts:

- server entrypoint: `server/dist/index.js`
- UI assets: `server/ui-dist`
- database: embedded PostgreSQL under `/home/jorge/dev/paperclip-dev-home`

The live database is persistent on disk. Normal service restarts, rebuilds, and code promotion steps do not wipe it.

However, persistence is not immunity:

- normal code changes do not delete data
- bad migrations or bad schema/runtime code can still damage data

Treat the live DB like real state, not disposable dev junk.

This is intentionally **not** the same as:

- `pnpm dev`
- `pnpm dev:once`
- the earlier `scripts/dev-runner.mjs` flow
- package/tarball-based local install testing

## Why the extra runtime overlay exists

Running `node server/dist/index.js` directly from the monorepo is not enough by itself.

Reason: several workspace packages still export `src/*.ts` by default for normal repo development. A plain production Node process starting from `server/dist/index.js` can otherwise resolve into source/dev package exports instead of built `dist` files.

To keep the live local instance repo-backed **without** mutating package manifests during runtime, the launcher creates an isolated runtime overlay:

- script: `scripts/setup-repo-runtime-node-path.mjs`
- output: `.repo-runtime/node_modules`

That overlay provides runtime package resolution pointing at built `dist` output for the workspace packages the server needs.

## Canonical Scripts

### 1. Prepare build artifacts

```bash
cd /home/jorge/dev/paperclip-dev
./scripts/prepare-repo-main.sh
```

What it does:

- builds the workspace
- builds the UI
- copies `ui/dist` into `server/ui-dist`

### 2. Run the local main instance manually

```bash
cd /home/jorge/dev/paperclip-dev
./scripts/run-repo-main.sh
```

What it does:

- loads `.env.devlocal` if present
- targets `/home/jorge/dev/paperclip-dev-home`
- creates the runtime overlay
- starts the live server from `server/dist/index.js`

### 3. Roll back to legacy npm-installed Paperclip

```bash
cd /home/jorge/dev/paperclip-dev
./scripts/rollback-to-npm-paperclip.sh
```

What it does:

- stops/disables the repo-backed user service
- launches the old instance with:

```bash
paperclipai run -d /home/jorge/.paperclip
```

## systemd --user Service

Service name:

```bash
paperclip-dev-main.service
```

This service now runs through a lightweight supervisor wrapper:

- `scripts/run-repo-main-supervised.sh`

The supervisor waits for `/api/health` to come up during startup, then keeps checking it on an interval. If the app becomes half-alive (for example Node still running but embedded Postgres is dead and health starts failing), the supervisor exits non-zero after repeated failed checks so `systemd` can restart the service cleanly.

Common commands:

### Status

```bash
systemctl --user status paperclip-dev-main.service
```

### Restart

```bash
systemctl --user restart paperclip-dev-main.service
```

### Logs

```bash
journalctl --user -u paperclip-dev-main.service -f
```

### Enable on login/startup

```bash
systemctl --user enable paperclip-dev-main.service
```

## Important Operating Rule

This live service is intentionally **persistent but not auto-building**.

That is deliberate.

If Jorge changes code in the dev repo, those edits do **not** automatically show up in the live local "production" instance used for daily task management.

The live instance runs from built artifacts from the same repo, so code changes become live only after an explicit prepare/promote step:

```bash
cd /home/jorge/dev/paperclip-dev
./scripts/prepare-repo-main.sh
systemctl --user restart paperclip-dev-main.service
```

Do **not** assume that restarting the service alone rebuilds changed code.

## Live vs Dev Flow

There are now two distinct ways to run this repo.

### 1. Live daily-driver instance

Use this for Jorge's real day-to-day Paperclip usage.

Properties:

- persistent background service
- runs under `systemd --user`
- uses live home: `/home/jorge/dev/paperclip-dev-home`
- uses live embedded Postgres at `/home/jorge/dev/paperclip-dev-home/instances/default/db`
- runs built/non-watch artifacts
- should be treated as real state

### 2. Dev/sandbox instance

Use this for feature work, risky iteration, watch-mode experiments, schema work, and breakage-tolerant testing.

Recommended shape:

```bash
cd /home/jorge/dev/paperclip-dev
PAPERCLIP_HOME=/home/jorge/dev/paperclip-dev-sandbox pnpm dev
```

Recommended principle:

- do **not** casually point `pnpm dev` at the live home
- do **not** let experimental dev runs share the live embedded Postgres data dir

By default, dev and live should be treated as separate instances with separate state.

## Promotion Flow

When a change is ready to move from repo work into the live daily-driver instance:

```bash
cd /home/jorge/dev/paperclip-dev
./scripts/prepare-repo-main.sh
systemctl --user restart paperclip-dev-main.service
```

Meaning:

- edit/test in dev as needed
- build/promote explicitly
- restart the live service

This explicit promotion step is the safety boundary between development and daily-driver use.

## Practical Guidance

### Usually safe to promote quickly

- UI polish
- small server behavior fixes
- low-risk display logic
- small adapter/runtime fixes already validated locally

### Use a separate dev instance first

- schema changes
- migrations
- auth/session changes
- storage changes
- runtime boot logic changes
- anything that could damage or orphan live state

## Health Check

Expected health endpoint:

```bash
curl http://127.0.0.1:3110/api/health
```

Expected result:

```json
{"status":"ok"}
```

## Known Local Decisions

### Chosen final path

- repo-first local runtime
- built assets
- systemd --user persistent service
- dedicated Paperclip home for this fork
- rollback retained

### Explicitly not the primary path

- package-first release hardening
- tarball install flow
- raw watch/dev harness for the live instance

## Related Runbook

For the reusable decision framework and step-by-step approach for choosing between repo-first local live runtime and package/release hardening, see `doc/LOCAL-LIVE-RUNBOOK.md`.

## Recommended Documentation Practice Going Forward

Yes — this repo should keep local-instance-specific operational documentation.

Recommended pattern:

- generic product/deploy docs stay in `docs/` and `doc/`
- Jorge-instance operational reality goes in repo-local docs like this one
- major local setup changes should be appended to `doc/LOCAL-INSTANCE-CHANGELOG.md`

## Suggested Next Improvement

Create a lightweight repo-local changelog for instance-affecting operational changes, for example:

- new service names
- port/home path changes
- runtime/launcher changes
- rollback procedure changes
- local-only patches needed to keep the fork running as the main instance

That would give a durable history instead of relying on chat transcripts.
