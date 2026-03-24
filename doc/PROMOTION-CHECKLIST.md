# Promotion Checklist: Dev → Live Repo-Backed Instance

Use this checklist before promoting Paperclip changes from development into Jorge's live repo-backed instance.

This exists because a feature can appear "done" in a dev instance while still being **non-promotable** if critical code is split across:

- committed branch state
- current working tree
- stash
- untracked files

That exact failure happened during the OpenClaw skills/provisioning work on 2026-03-24.

## Rule

A feature is **not live-ready** just because it works in `pnpm dev`.

A feature is only promotion-ready when the repo state that will actually be built for the live instance contains **all required source, wiring, and tracked files**.

## Promotion Gate

Before promoting, verify all of the following.

### 1. Git state sanity

```bash
git status --short
git stash list
```

Required checks:

- no critical feature files are stranded in `stash`
- no critical new files are still untracked
- no important behavior exists only in local dev state

If a feature is real enough to be in `project-tracker`, it should generally be committed or at minimum captured in explicit tracked source files.

## 2. Source surface sanity

For the feature being promoted, confirm:

- source files exist in the canonical repo paths
- new entrypoints are exported
- registries/modules actually wire the feature in
- client/server/shared types line up
- the UI path you expect is the one actually used by the app

This matters especially for monorepo features that can fail at the seams:

- adapter exports
- server registry wiring
- route integration
- UI component usage
- shared type contracts

## 3. Build sanity

Run the real prepare flow:

```bash
cd /home/jorge/dev/paperclip-dev
./scripts/prepare-repo-main.sh
```

Required checks:

- workspace build succeeds
- UI build succeeds
- `server/ui-dist` refreshes
- no feature-critical type drift remains

## 4. Built artifact sanity

If the work is UI-heavy or route-heavy, grep built output for expected strings/behaviors.

Examples:

```bash
grep -Rni "Adopt locally\|Remove local override\|Provision Paperclip access \+ required skills" server/ui-dist ui/dist
```

This is not elegant, but it catches the very real case where source looks right and the built output still does not contain the expected feature surface.

## 5. Live restart

Promote explicitly:

```bash
systemctl --user restart paperclip-dev-main.service
systemctl --user status paperclip-dev-main.service --no-pager
curl http://127.0.0.1:3110/api/health
```

Required checks:

- service healthy
- embedded Postgres healthy
- supervisor wrapper still passing startup health

## 6. Browser/client sanity

After promotion:

- hard refresh browser
- re-open affected views
- verify expected UI behavior against the tracker/acceptance list

This avoids misreading stale client bundles as failed deployment.

## 7. Documentation / continuity

After successful promotion:

- update `doc/LOCAL-INSTANCE-CHANGELOG.md`
- update project-tracker progress if relevant
- log the promotion nuance if a new failure mode was discovered

## Dev vs Live Operating Rule

### Dev
- may use watch mode
- may be broken
- may use separate sandbox state
- is not proof of promotion-readiness by itself

### Live
- runs built artifacts
- uses persistent live state
- must be promoted explicitly
- should only receive consolidated repo state

## Strong recommendation

Do **not** use stash as a parking lot for active feature phases.

If a feature matters:
- commit it on a branch, or
- checkpoint it in a WIP commit

Stash is fine for short-lived context switching. It is terrible as the hidden source of truth for a product feature.

## 2026-03-24 Failure Pattern Captured

What failed during the OpenClaw skills/provisioning promotion:

- dev instance showed richer local state
- backend work was partly committed
- richer per-agent skills UI was trapped in `stash@{0}`
- some supporting files were trapped in the stash untracked-files object
- live build was therefore missing parity even though dev looked correct

### Durable lesson

**"Works in dev" is not enough.**

Promotion requires a consolidated repo state with no critical feature logic hiding in stash, untracked files, or unwired module seams.
