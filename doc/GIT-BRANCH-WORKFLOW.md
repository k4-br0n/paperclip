# Git / GitHub Branch Workflow for k4br0n Paperclip Fork

This note explains how the Paperclip fork is structured on GitHub, how to think about upstream sync, and how to keep the live custom OpenClaw-enabled instance maintainable over time.

## Repo model

There are now three GitHub repositories involved:

- **Upstream public repo:** `paperclipai/paperclip`
- **Personal public fork:** `k4-br0n/paperclip`
- **Private dev workbench:** `k4-br0n/paperclip-dev-private`

Role split:
- **private dev workbench** = active debugging, messy intermediate commits, private issue tracking, Jorge-specific experimentation
- **personal public fork** = promotion target only once work is coherent and safe to expose publicly
- **upstream public repo** = only for confirmed non-fork-specific bugs/fixes that are ready for proper upstream reporting or PRs

## Remote names in the local repo

In the local clone at `/home/jorge/dev/paperclip-dev`:

- `origin` = upstream public repo (`paperclipai/paperclip`)
- `fork` = personal public fork (`k4-br0n/paperclip`)
- `private` = private dev workbench (`k4-br0n/paperclip-dev-private`)

Verify with:

```bash
git remote -v
```

## Branch roles

### `master`
Purpose:
- upstream-tracking baseline
- comparison point for ahead/behind counts
- source for testing or merging upstream updates into the private live branch

Important:
- keep this branch relatively clean
- treat it as the fork's copy of upstream `master`
- do not put private live-instance-only work here unless there is a deliberate reason

### `k4br0n/live`
Purpose:
- the real private live baseline branch
- current custom branch for the working OpenClaw-enabled Paperclip instance
- the branch that should reflect the instance Jorge is actually running day-to-day

This branch is where custom Paperclip runtime, OpenClaw integration, and live-instance-specific work should accumulate.

### `k4br0n/feature/*`
Purpose:
- temporary feature or bugfix branches off `k4br0n/live`
- use for risky work or multi-session implementations

Examples:
- `k4br0n/feature/skill-policy-preview`
- `k4br0n/feature/onboarding-flow`

### `k4br0n/backup/*`
Purpose:
- recovery/snapshot branches before or after risky incidents or major migrations
- preserve a known-good state with context in the branch name

Examples:
- `k4br0n/backup/2026-03-24-live-recovery-working`
- `k4br0n/backup/2026-04-01-pre-upstream-merge`

These are safety markers, not the normal daily working branch.

## Current recommended model

- do active debugging work against the **private** remote first
- keep `master` on the public fork as an upstream-ish baseline if useful
- keep the public custom baseline on `k4br0n/live`, but treat it as a **promotion branch**, not the messy scratchpad
- create feature/debug branches locally as needed, and push them to `private` during active investigation
- only push to `fork` once the work is coherent, reviewable, and safe to expose publicly
- create backup branches for recovery checkpoints, not as the permanent mainline

## What ahead / behind means

If GitHub says a branch is:
- **N commits behind** → the comparison base has N commits this branch does not have
- **M commits ahead** → this branch has M commits the comparison base does not have

That is normal for a private fork.

It does **not** mean anything is broken. It just means the histories have diverged.

## Upstream sync workflow

### Goal
Bring the latest upstream Paperclip changes into the fork's baseline, then optionally merge them into the private live branch.

## Step 1 — refresh local upstream view

```bash
cd /home/jorge/dev/paperclip-dev
git fetch origin
git fetch fork
```

## Step 2 — update local `master` to match upstream `origin/master`

```bash
git checkout master
git reset --hard origin/master
```

### Why `reset --hard` here?
Because `master` is being treated as the clean upstream-tracking copy. This is intentional. Do **not** run this if you have uncommitted work on `master` that you care about.

## Step 3 — push refreshed `master` to the GitHub fork

```bash
git push fork master --force-with-lease
```

This updates the fork's `master` branch so it mirrors upstream cleanly.

## Step 4 — bring upstream updates into the live branch

Switch to the private live branch:

```bash
git checkout k4br0n/live
```

Then merge the refreshed `master` into it:

```bash
git merge master
```

### Why merge instead of rebase?
For this repo/workflow, merge is simpler and safer for now:
- preserves branch history clearly
- avoids rewriting your private branch history
- is less error-prone during ongoing local/live operations

Use rebase only if you deliberately want a cleaner history and are comfortable rewriting branch history.

## Step 5 — test the merged result before promotion

For Paperclip live-instance work, do **not** promote upstream merges blindly.

Run:

```bash
./scripts/prepare-repo-main.sh
systemctl --user restart paperclip-dev-main.service
curl http://127.0.0.1:3110/api/health
```

Then test the affected UI/runtime flows.

## Promotion rule after upstream merge

If the merged branch is good, push it:

```bash
git push fork k4br0n/live
```

At that point the GitHub fork and the VPS live branch are aligned again.

## Typical day-to-day workflows

### A. Make a small change directly on the live branch

```bash
git checkout k4br0n/live
# make changes
./scripts/prepare-repo-main.sh
systemctl --user restart paperclip-dev-main.service
# verify

git status --short
git stash list
git add ...
git commit -m "..."
git push fork k4br0n/live
```

### B. Do safer feature work on a feature branch

```bash
git checkout k4br0n/live
git checkout -b k4br0n/feature/my-change
# build/test/work

git add ...
git commit -m "..."
git push fork k4br0n/feature/my-change
```

Then merge back into live:

```bash
git checkout k4br0n/live
git merge k4br0n/feature/my-change
git push fork k4br0n/live
```

### C. Create a backup branch before risky work

```bash
git checkout k4br0n/live
git checkout -b k4br0n/backup/2026-03-24-pre-risky-merge
git push fork k4br0n/backup/2026-03-24-pre-risky-merge
```

## Critical anti-footgun rules

### 1. Do not use stash as the hidden source of truth
If work matters, commit it or at least checkpoint it on a branch.

### 2. Always check these before promotion
```bash
git status --short
git stash list
```

### 3. Dev success does not equal promotion readiness
The live instance builds from repo state, not from magical local vibes.

### 4. Keep `.env.devlocal` local
Do not casually commit environment-specific secrets/config.

## Recommended future commands reference

### See remotes
```bash
git remote -v
```

### See branches and tracking
```bash
git branch -vv
```

### Refresh upstream + fork refs
```bash
git fetch origin
git fetch fork
```

### Update local master from upstream
```bash
git checkout master
git reset --hard origin/master
git push fork master --force-with-lease
```

### Merge upstream baseline into live
```bash
git checkout k4br0n/live
git merge master
git push fork k4br0n/live
```

### Create a feature branch from live
```bash
git checkout k4br0n/live
git checkout -b k4br0n/feature/my-feature
git push -u fork k4br0n/feature/my-feature
```

### Create a backup branch from live
```bash
git checkout k4br0n/live
git checkout -b k4br0n/backup/2026-03-24-snapshot
git push -u fork k4br0n/backup/2026-03-24-snapshot
```

## Paperclip-specific rule

For this fork, the GitHub branch model should reflect the runtime reality:
- `master` = upstream-ish reference line
- `k4br0n/live` = the branch that matches the actual working OpenClaw-enabled live Paperclip instance
- feature/backup branches = supporting structure around that live branch
