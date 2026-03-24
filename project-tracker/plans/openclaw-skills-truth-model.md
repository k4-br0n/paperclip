# Paperclip × OpenClaw Skills Truth Model

## Purpose
Define the canonical truth model for how Paperclip should discover, represent, and manage OpenClaw skills without lying about effective runtime availability.

This document is the implementation contract for the current phase.

---

## Core stance
For OpenClaw integration, **the filesystem is truth**.

Paperclip must not behave as though its own company-skills database is the canonical source of skill existence for OpenClaw agents.

Instead:
- OpenClaw skill directories on disk are the source of truth for availability
- Paperclip maintains an indexed/catalogued view of that reality
- adapter/runtime state remains a separate observed layer

In short:
- **disk truth** → what exists
- **catalog truth** → what Paperclip knows and can explain
- **runtime truth** → what the adapter/OpenClaw runtime is actually using

---

## Why this matters
Paperclip’s current skill manager is centered on company-managed skill records:
- import skills
- scan project workspaces
- store rows in `company_skills`
- attach canonical skill keys to agents via `desiredSkills`
- materialize runtime skill entries for adapters

That works for Paperclip-managed catalogs, but OpenClaw’s skill model is different:
- global skills can already exist independently of Paperclip
- local workspace skills can shadow global ones
- bundled skills exist whether or not Paperclip imported them
- effective availability depends on OpenClaw resolution order, not just Paperclip rows

If Paperclip keeps pretending the DB is truth, the UI will drift from reality.

---

## OpenClaw precedence model
Confirmed OpenClaw precedence:
1. `<workspace>/skills`
2. `~/.openclaw/skills`
3. bundled skills
4. optional `skills.load.extraDirs`

Implications:
- A local workspace skill shadows a global skill with the same identity.
- Global presence does not guarantee effective use if a local override exists.
- Bundled skills must be represented even when no local/global copy exists.
- `extraDirs` may later broaden discovery, but we should not build around config mutation first.

---

## Canonical scope model
Paperclip should represent skills with explicit scope.

### 1. Bundled
Skills shipped with OpenClaw/Paperclip runtime.

Properties:
- not user-owned
- always read-only
- available by convention/runtime package presence
- lowest-precedence built-in layer before extra dirs are considered

### 2. Global
Machine-shared OpenClaw skills.

Canonical initial directory:
- `~/.openclaw/skills`

Properties:
- shared across agents/workspaces on the machine
- higher precedence than bundled
- lower precedence than workspace-local
- should be discoverable whether or not Paperclip created/imported them

### 3. Local
Workspace-scoped skills.

Canonical initial directory:
- `<agent-workspace>/skills`

Properties:
- tied to one workspace/agent/runtime context
- shadows same-key global skill
- highest standard precedence in the OpenClaw model

### 4. Extra-dir (deferred but modelled)
Optional skills loaded from configured extra directories.

Properties:
- not phase-1 mutation territory
- should still exist in the model so the UI doesn’t hardcode a false world
- initially likely represented as observed/read-only if discovered later

---

## Identity model
A skill must not be identified by slug alone.

### Canonical identity fields
Each discovered/effective skill record should eventually have:
- `key`: canonical logical identity
- `slug`: human-friendly shortname
- `scope`: `bundled | global | local | extra_dir`
- `sourceKind`: where it came from (`filesystem`, `paperclip_import`, `github`, `skills_sh`, etc.)
- `sourcePath`: concrete filesystem path when applicable
- `workspaceId`: nullable; set for local skills
- `originLocator`: original remote/import locator if relevant

### Why slug alone fails
Because these are all possible and distinct:
- local `review` in workspace A
- local `review` in workspace B
- global `review`
- bundled `review`

Those may share a slug but not the same effective meaning.

### Recommended rule
- `key` should represent the canonical logical skill identity
- `scope + sourcePath (+ workspaceId when local)` should represent the concrete instance
- effective resolution must compare by logical identity, not just display name

---

## Three-layer truth model

## Layer 1 — Discovery truth
This answers: **what skill artifacts exist on disk?**

Paperclip should discover from:
- bundled skills root(s)
- global OpenClaw root: `~/.openclaw/skills`
- local workspace roots: `<workspace>/skills`
- later: configured extra dirs

This layer is filesystem-first and can be refreshed/re-scanned.

Output shape should include:
- discovered path
- normalized scope
- file inventory
- parsed metadata from `SKILL.md`
- trust/health indicators

## Layer 2 — Catalog truth
This answers: **what does Paperclip know about this skill as an entity?**

Paperclip can still keep normalized DB records, but they must be understood as:
- an index/cache
- metadata enrichment store
- assignment anchor
- UI/search source

The catalog must not invent existence.

Catalog rows should be reconcilable back to discovered artifacts.

## Layer 3 — Runtime truth
This answers: **what will or does the agent actually use?**

This includes:
- desired skill assignment state
- effective resolved skill state
- local shadowing/global fallback
- adapter-reported actual state when available

This is what the operator actually cares about.

---

## Required UI distinctions
The UI must show three different concepts separately.

### A. Exists
The skill artifact exists on disk or as a bundled capability.

### B. Assigned
Paperclip wants an agent to use the skill.

### C. Effective
The agent will actually resolve/use this concrete version.

These are not the same.

Example:
- global skill exists
- agent is assigned that skill
- but a local override is present
- therefore effective source is local, not global

If the UI collapses these into one state, it will mislead operators.

---

## Effective state model
Per agent + logical skill identity, Paperclip should be able to compute:

- `absent` — not discovered in any relevant scope
- `bundled_only` — only bundled copy exists
- `global_only` — global copy exists, no local override
- `local_only` — only local copy exists
- `local_overrides_global` — both exist, local wins
- `assigned_global` — assigned and resolved from global
- `assigned_local` — assigned and resolved from local
- `assigned_bundled` — assigned and resolved from bundled
- `broken` — expected artifact missing or invalid
- `hidden/unmanaged` — known but not currently manageable in this phase

Initial implementation can simplify labels, but the internal model should support these distinctions.

---

## Assignment semantics
Assignment and installation are different.

### Assignment
Means:
- Paperclip records the intent that an agent should have/use a skill
- represented in desired skill state / sync preference
- does **not** necessarily copy files

### Installation
Means:
- a concrete skill artifact is placed into a target scope on disk
- e.g. copy/sync global skill into `<workspace>/skills/<slug>`

### Rule
Paperclip must never imply that assignment automatically means local installation.

That distinction is central to avoiding config drift and operator confusion.

---

## Recommended operational rules for OpenClaw integration

## Rule 1
`~/.openclaw/skills` is the canonical initial **global** skills directory.

## Rule 2
`<agent-workspace>/skills` is the canonical initial **local** skills directory.

## Rule 3
Paperclip should discover and index both, not force-import them first.

## Rule 4
Paperclip DB records should store enough metadata to explain discovered origin and effective precedence.

## Rule 5
Agent desired skills should stay canonical-key based, but effective-state computation must resolve against discovered local/global/bundled instances.

## Rule 6
Local install/sync should be an explicit operator action.

## Rule 7
Config allowlists / visibility restrictions are deferred until this truth model works.

---

## Gaps in the current Paperclip model
Current Paperclip already has pieces we can reuse:
- `company_skills` table and service
- project workspace scan
- runtime skill materialization
- canonical desired skill assignment
- adapter skill snapshots

But it still lacks explicit OpenClaw truth semantics:
- no first-class `global` vs `local` scope in shared types
- no OpenClaw-specific filesystem discovery contract
- no effective-state computation for local shadowing global
- no distinction between discovered-on-disk and imported-into-company-library as separate truths
- no explicit UI model for “exists / assigned / effective”

---

## Proposed implementation direction

## Phase 1 — model and discovery
- add explicit scope/source concepts to shared types
- add discovery of global OpenClaw skills from `~/.openclaw/skills`
- normalize local OpenClaw skills from workspace roots
- preserve bundled discovery

## Phase 2 — effective-state computation
- compute per-agent effective skill state from discovered artifacts + desired assignment
- detect local-over-global shadowing
- distinguish assignment from installation

## Phase 3 — UI truthfulness
- show source scope labels: bundled/global/local
- show effective resolution for each agent
- show shadowing clearly
- show broken/missing states

## Phase 4 — local install/sync actions
- explicit “install global to local” / “sync local override from global” actions
- safe diffs and status

## Phase 5 — policy/deferred config work
- preview-only visibility/config diff
- only then consider actual config mutation

---

## Non-goals for this phase
- automatic config writes to OpenClaw allowlists
- pretending all adapters behave the same way
- conflating company-library management with OpenClaw filesystem truth
- making Paperclip the owner of bundled skills

---

## Decision summary
Paperclip should treat OpenClaw skills as a **filesystem-indexed, scope-aware, precedence-aware system**.

The company skill database remains useful, but only as a catalog and control-plane layer.

For OpenClaw:
- **disk is truth**
- **Paperclip is the index and operator console**
- **runtime observation is the final arbiter of effective usage**
