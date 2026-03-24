# Local Live Runbook: Repo-First Runtime vs Packaging

This document captures the repeatable approach for getting a Paperclip fork live locally **without** confusing that work with package/release hardening.

## The two lanes

There are two different jobs. Do not mix them up.

### Lane A — Repo-first local live runtime

Use this when the goal is:

- run a local fork as the main instance
- keep editing the repo directly
- use built assets and non-watch mode
- wrap it in a stable launcher or `systemd --user` service
- preserve rollback to an older local instance

This was Jorge's actual goal for `/home/jorge/dev/paperclip-dev`.

### Lane B — Package/release hardening

Use this when the goal is:

- make tarballs/packages install cleanly outside the monorepo
- prepare npm publishing or release artifacts
- make package manifests portable beyond the repo
- validate publish/install workflows

This is a valid lane, but it is **not** required just to run the fork locally as the main instance.

## Rule of thumb

If the question is "How do I make my fork the live local instance on this machine?" then start with **Lane A**.

Only enter **Lane B** if local live runtime still cannot be achieved without it.

## Lane A: Repo-first local live runtime

### Goal

Run the server from repo-built artifacts while preserving normal development in the repo.

### Canonical shape

- build workspace packages
- build UI
- copy UI into `server/ui-dist`
- start `server/dist/index.js`
- ensure runtime package resolution hits built `dist` outputs, not source TS exports
- wrap in a stable launcher and `systemd --user`

### Problems this lane usually hits

#### 1. Dev harness is not suitable for a live local main instance

Examples:

- `pnpm dev`
- `pnpm dev:once`
- `scripts/dev-runner.mjs`

Why not:

- watch-mode behavior
- dev-only assumptions
- environment/path coupling
- awkward service behavior

#### 2. `node server/dist/index.js` is not automatically enough in a monorepo

Why:

- workspace packages may still export `src/*.ts`
- runtime resolution can walk into source/dev paths instead of built `dist`
- plain Node runtime then fails on TS-oriented export surfaces

### Stable solution used here

#### Prepare step

```bash
./scripts/prepare-repo-main.sh
```

This should:

- build the repo workspace
- build the UI
- copy `ui/dist` to `server/ui-dist`

#### Runtime overlay step

```bash
node scripts/setup-repo-runtime-node-path.mjs
```

Purpose:

- create an isolated `.repo-runtime/node_modules`
- point runtime package resolution at built `dist` outputs
- avoid mutating package manifests during live runtime

#### Run step

```bash
./scripts/run-repo-main.sh
```

This should:

- set `PAPERCLIP_HOME` to the dedicated local instance home
- configure stable non-watch runtime env
- create/use the runtime overlay
- execute `node server/dist/index.js`

#### Persist step

Use `systemd --user` with a dedicated service file.

Recommended hardening: wrap the live launcher in a tiny supervisor that:

- waits for `/api/health` to pass on startup
- periodically re-checks `/api/health`
- exits non-zero if the service becomes unhealthy for several consecutive checks

That avoids the bad state where the main Node process survives but embedded Postgres dies underneath it, leaving a zombie UI shell that returns fetch/auth errors.

### Verification checklist

After bringing the repo-first instance live, verify all of this:

- service starts cleanly
- health endpoint returns OK
- UI loads from static build
- embedded PostgreSQL points at the intended instance home
- service restarts on failure
- rollback path still exists

Example checks:

```bash
systemctl --user status paperclip-dev-main.service
curl http://127.0.0.1:3110/api/health
journalctl --user -u paperclip-dev-main.service -f
```

### Operating rule

Persistent does **not** mean auto-building.

If you edit the dev repo, those changes do **not** automatically appear in the live local daily-driver instance.

They become live only after an explicit promotion step:

```bash
./scripts/prepare-repo-main.sh
systemctl --user restart paperclip-dev-main.service
```

So the live instance is repo-backed, but it runs from built artifacts, not directly from your unbuilt working tree.

That explicitness is a feature, not a bug.

## Lane B: Packaging/release hardening

### Use this lane when

You need packages to work outside the monorepo.

Typical triggers:

- local tarball install testing
- npm publish preparation
- release automation
- validating packed manifests and external installability

### Problems this lane usually hits

- `workspace:*` deps in packed manifests
- `exports` still pointing at `src/*.ts`
- prepack scripts assuming repo-local `pnpm`
- package root exports missing symbols used by runtime code
- server package not carrying its built UI payload

### Typical work in this lane

- rewrite package manifests for publish/install
- convert workspace dependencies to real versions
- ensure `publishConfig` exports/main/types are correct
- pack/install in isolated temp directories
- fix missing exports needed by packaged runtime

### Important warning

Success in Lane B does **not** mean you chose the right lane.

If the original goal was only to run the fork as the live local instance, package hardening may be wasted motion.

## Decision checklist before starting work

Ask these first:

1. Is the desired runtime **repo-backed** or **package-backed**?
2. Does the user need a **persistent local instance** or a **portable release artifact**?
3. Is watch/dev mode acceptable? Usually no for a live main instance.
4. Is rollback required? If yes, document it before cutover.
5. Do we need runtime package resolution fixes, packaging fixes, or both?

## What we used for Jorge's fork

For `/home/jorge/dev/paperclip-dev`, the winning path was:

- repo-first live runtime
- built assets
- runtime overlay for workspace package resolution
- `systemd --user` persistent service
- dedicated Paperclip home
- explicit rollback to legacy npm-installed instance
- separate conceptual split between live daily-driver state and dev/sandbox state

## Dev vs Live Rule

Do not blur these two:

### Live
- persistent service
- real state
- daily-driver usage
- dedicated home: `/home/jorge/dev/paperclip-dev-home`

### Dev
- experimental work
- watch mode allowed
- can be broken safely
- should use a separate home, e.g. `/home/jorge/dev/paperclip-dev-sandbox`

Example dev run:

```bash
cd /home/jorge/dev/paperclip-dev
PAPERCLIP_HOME=/home/jorge/dev/paperclip-dev-sandbox pnpm dev
```

Promotion into live remains explicit:

```bash
cd /home/jorge/dev/paperclip-dev
./scripts/prepare-repo-main.sh
systemctl --user restart paperclip-dev-main.service
```

## Recommended documentation set

For local operational durability, keep all four:

### 1. Instance-specific ops doc

- `doc/LOCAL-INSTANCE-JORGE.md`

### 2. Runbook for choosing and executing the right lane

- `doc/LOCAL-LIVE-RUNBOOK.md`

### 3. Lightweight changelog of local operational changes

- `doc/LOCAL-INSTANCE-CHANGELOG.md`

That changelog should capture:

- service changes
- port/home changes
- launcher/runtime changes
- packaging-related decisions that affect local live ops
- rollback procedure changes

### 4. Promotion checklist / anti-drift guardrail

- `doc/PROMOTION-CHECKLIST.md`

Use this before promoting dev work into the live repo-backed instance so a feature is not falsely treated as ready just because it worked in a dev server with stash/untracked state.

## Minimal reusable checklist

If you need to do this again for another fork:

1. Decide repo-first vs package-first.
2. Pick the real live entrypoint.
3. Ensure UI build is available to the server.
4. Fix runtime package resolution for built workspace packages.
5. Add a dedicated launcher script.
6. Use a dedicated instance home.
7. Add `systemd --user` service.
8. Verify health/logs/restart behavior.
9. Preserve rollback.
10. Document the final shape in-repo immediately.
