---
type: 👨‍💻 project
Project: Paperclip OpenClaw Skills Management Integration Plan
Status: in progress
Owner: Telos
Date: 2026-03-23
Updated: 2026-03-23
area:
 - "[[OpenClaw]]"
---

# Paperclip OpenClaw Skills Management Integration Plan

## Objective
Build a clean skills-management layer between Paperclip and OpenClaw so Paperclip can manage shared/global skills, surface them accurately in the UI, and selectively assign/install them to OpenClaw agents without creating config drift or skill-resolution confusion.

## Why this is a new phase
The previous phase focused on **native OpenClaw agent onboarding, routing, provisioning, and identity separation**. That slice is now validated in the dev instance and should not keep polluting the context for the next implementation phase.

This phase is specifically about **skill management**, not native-agent binding.

## Desired outcomes
- Paperclip skills work with OpenClaw agents.
- Skills downloaded in Paperclip land in a **global skills directory**.
- Skills in that global directory appear in the **Paperclip skills UI**.
- Global skills can be assigned to individual agents for **local install** where needed.
- Operators can eventually control which agents can see which global skills.
- The implementation respects OpenClaw skill precedence and does not lie about effective availability.

## Important OpenClaw context
Confirmed OpenClaw skill precedence:
1. `<workspace>/skills`
2. `~/.openclaw/skills`
3. bundled skills
4. optional `skills.load.extraDirs`

Implications:
- Global skills should naturally live in `~/.openclaw/skills` unless we discover a stronger reason to use another canonical directory.
- Agent-local installs should land in that agent workspace’s `skills/` directory.
- Paperclip must show **effective precedence/shadowing**, not just raw file presence.

## Product requirements currently in scope
- Global skills directory visibility in Paperclip UI
- Accurate global/local/effective skill state per agent
- Assign global skill to agent
- Install/copy/sync global skill locally for agent when required
- Skill source / install mode / health visibility
- Safe operator UX before we touch OpenClaw config allowlists

## Explicitly deferred for later
- Editing `openclaw.json` / agent allowlists automatically
- Agent-by-agent global skill visibility restrictions that require config writes
- Broad skill policy automation before the underlying truth model is stable

## Recommended build sequence
### Phase A — visibility and truth
- detect global OpenClaw skills directory
- read global skills into Paperclip UI
- show source / precedence / health status

### Phase B — assignment
- assign a global skill to an agent
- support local install into agent workspace where needed
- show whether the agent is using global or local copy

### Phase C — validation
- verify assigned skills actually resolve for OpenClaw agents
- show broken/missing dependency states clearly

### Phase D — policy control
- preview-only allowlist/config diff tooling
- explicit confirmation before config writes
- actual config mutation only after the visibility and assignment model is proven

## Success criteria
This phase is successful when:
- Paperclip can truthfully show global and local OpenClaw skills
- operators can assign/install skills without ambiguity
- an OpenClaw agent’s effective skill availability can be explained from the UI
- the system avoids silent drift between Paperclip UI, disk state, and OpenClaw runtime behavior

## 2026-03-23 implementation checkpoint
- Added dedicated truth-model plan: `project-tracker/plans/openclaw-skills-truth-model.md`.
- Expanded task tracker to break work into discovery, truth model, server model refactor, shared contracts, effective-state engine, UI truthfulness, install semantics, and tests.
- Implemented first model foundation in code:
  - shared types/validators now include `scope`, `truthOrigin`, and agent-skill `effectiveState`
  - server now infers scope/truth metadata from skill metadata instead of treating `sourceType` as sufficient
  - OpenClaw global skills are now discovered from `~/.openclaw/skills`
  - runtime materialization now prefers the highest-precedence scope per logical key
  - UI now has a first-pass display for scope/truth fields in company skill detail and agent skill rows
- Next implementation target before the next live test: replace the legacy unsupported OpenClaw agent skill path with a native OpenClaw-aware `/agents/:id/skills` snapshot.
- Locked design constraint from Jorge: OpenClaw agent-local skill adoption must write into the agent workspace’s real `skills/` directory. No Paperclip-only sidecar/local-workaround path is acceptable for local OpenClaw installs.
- Implementation implication: for OpenClaw agents, the agent Skills tab must derive from native OpenClaw roots and precedence rules first; Paperclip remains the control plane and index, not an alternate local skill filesystem.
- New backlog item from live testing: some skills present in Telos local skill directories still do not show up in native/effective OpenClaw visibility. Treat this as an OpenClaw-side discoverability bug to investigate later, and potentially add Paperclip diagnostics for “on disk but not discoverable by runtime” cases.
- Next implementation slice is the explicit local-adopt/install workflow for OpenClaw agents: Paperclip should copy/sync a chosen global skill into the agent workspace’s real `skills/` directory, then let native OpenClaw precedence do the rest.
- Live testing result: first explicit OpenClaw local adoption workflow is now working end-to-end (UI action, toast feedback, real workspace copy, action hiding after success).
- Bugs logged from live testing:
  - recurring WebSocket/live-updates console errors on reload (`ws://127.0.0.1:13111` and `/api/companies/:id/events/ws`)
  - intermittent/consistent follow-up GET 500 on `/api/agents/:id/skills` immediately after successful local adoption; copy succeeds but readback path still needs hardening
- Current implementation focus has narrowed deliberately: ignore the websocket/live-updates noise for now and harden the actual feature by fixing post-adopt readback, stabilizing local/global/effective refresh, then adding resync/update semantics for adopted locals.
- Live testing now confirms the full first local-management lifecycle works for OpenClaw agents:
  - adopt global → local workspace skill
  - show readable success/error feedback
  - transition from adopt action into local-management menu
  - resync local copy from global
  - remove local override and fall back to global
  - re-show adopt action after local removal
- Next implementation phase is stabilization: add automated test coverage for global discovery, native OpenClaw agent snapshot behavior, local-overrides-global precedence, adopt/remove/resync flows, and regression protection around the newly working lifecycle.
- Focused Vitest run completed against the new/adjacent lifecycle coverage. Result: passing after fixing one unrelated adapter regression in `packages/adapters/openclaw-gateway/src/server/execute.ts` (missing `node:path` import in claimed-key path resolution).
- Next stabilization slice: add bundled-fallback test coverage and a UI/state transition test around the OpenClaw skill row actions so this phase ends with better regression protection on both server and UI behavior.
- Completed stabilization additions:
  - bundled fallback test coverage for required OpenClaw/Paperclip skills when no local/global copy exists
  - UI/state regression coverage ensuring locally effective company-managed skills remain in the managed section
  - reran focused Vitest slices successfully after these additions
- Jorge chose to do a short UI/UX cleanup pass before starting the next substantive phase. Focus now is clearer badges/labels, cleaner operator-facing copy, and more legible local/global/install state in the agent Skills UI.
- New follow-on question from live use: required/bundled Paperclip skills are still not effectively available to OpenClaw agents. Need to inspect the current required-skill path and decide whether OpenClaw should treat them as bundled visibility, global sync, local copy, or a hybrid model.
- New phase started: `project-tracker/notes/openclaw-required-skills-provisioning-phase.big-brain.md`
- Decision for this phase: required Paperclip skills should be provisioned as Paperclip-owned **local installs** in the real OpenClaw agent workspace `skills/` directory, and this should happen during agent provisioning so the skills are present immediately after the provisioning flow.
- New provisioning UX follow-up from live reasoning: capture the OpenClaw workspace path as early as possible during provisioning, but also provide an explicit re-provision/install-required-skills action after later config changes. Avoid pretending provisioning is fully successful when the local install target path is unknown.
- Further live refinement: for the human-driven advanced OpenClaw flow, do not eagerly auto-provision on create. Instead, persist the workspace root from the create form into the created agent config, then gate the per-agent provisioning action on both workspace root and bound native OpenClaw agent id, with explicit guidance telling the human what remains to be configured.
- Current project status: the core Paperclip × OpenClaw skills-management workflow is now working end-to-end. Paperclip can discover global/local skills, report effective state, manage optional local adoption/removal/resync, and provision required Paperclip skills into native local OpenClaw workspace paths through the human-driven configuration flow.
- Remaining work is now mostly refinement: UX polish, backlog diagnostics, and the next phase of smarter diff/sync intelligence rather than basic capability enablement.
- This current implementation phase can be closed out as functionally successful. The next chat/phase should start from the stabilized base now in place and move into smarter diff/sync intelligence and any logged UX backlog items rather than re-litigating the basic OpenClaw skills-management workflow.
- UX backlog captured at close-out: clearer per-agent provisioning-status banner, more help popovers on OpenClaw config fields, and required-field asterisk treatment for the provisioning prerequisites.
- Next major development phase requested by Jorge: Paperclip project notes. The goal is to link each Paperclip project to a canonical markdown `project note` file that contains the project’s governance/source-of-truth, with YAML frontmatter syncing back into Paperclip where appropriate. This next phase should design the architecture, schema, sync semantics, scripts, and the project-manager-agent workflow that uses the project note as the decision-making reference.

## Forward design notes — Paperclip project notes + project manager model

### Parallel company-level onboarding idea
In parallel with project notes, Jorge also wants a company-level onboarding/governance layer:
- a canonical company overview markdown document explaining what the business does, its structure, major folders/repos, and operating conventions
- a core global onboarding skill assigned to agents during onboarding that teaches them how to use that company overview and operate within the company repo/folder structure

Recommended split:
- **company overview note** = living company truth
- **company onboarding skill** = how agents read/use that truth operationally
- **project note** = project-level governance and orchestration context

This should be treated as a companion design thread to project notes, not collapsed into the same artifact.


### Core idea
A Paperclip project note should be the project’s **governing document**, not just extra markdown.

Paperclip project record holds:
- identity
- status
- owners
- tasks
- runs
- approvals

Project note holds:
- why the project exists
- what success means
- constraints
- decision rights
- current strategy
- active assumptions
- orchestration rules
- when to pause/escalate
- who should handle what

This makes the note the operating constitution for the project manager agent.

### Design stance
Do not start with “sync every field.”
Start with:
- what decisions the project manager may make without approval
- what decisions require escalation
- what must remain inside the governance note vs what should be mirrored into Paperclip UI

The project note should constrain the agent’s freedom rather than trying to replace its intelligence.

### Project manager responsibilities inside Paperclip
The project manager agent should be responsible for:

1. **Maintaining the project note**
- keep status current
- update assumptions/risks
- record decisions
- track current strategy
- maintain coherent next actions

2. **Decomposing work**
- translate project goals into task batches
- decide what becomes a Paperclip task
- decide which agent owns which task
- manage sequencing and dependencies

3. **Governing execution**
- compare current work against the note
- detect scope/strategy conflicts
- decide whether to continue, reroute, pause, or escalate

4. **Keeping Paperclip aligned**
- sync selected structured fields from the note into the Paperclip project
- keep project/task statuses aligned with note reality
- reduce drift between markdown governance and system state

5. **Escalating strategically**
- route for approval when governance boundaries are crossed
- prevent silent AI-led strategy shifts

### Decision boundaries model
The note should explicitly define:

#### PM agent may decide without approval
- task decomposition
- task reassignment between approved agents
- sequencing changes
- low-risk execution adjustments
- operational clarifications

#### PM agent must pause/escalate for approval
- strategy change
- scope change
- success criteria change
- budget/time/risk increase
- audience/market/product direction shift
- project pause/abandonment
- overriding prior explicit decisions

This is the key guardrail for keeping orchestration intelligent without letting it become executive improvisation.

### Architecture recommendation
First model should be:
- **one Paperclip project ↔ one canonical markdown project note**

Paperclip stores:
- `projectNotePath`
- maybe `projectNoteId`, `projectNoteHash`, `lastSyncedAt`
- selected mirrored fields

Markdown note stores:
- governance/state
- YAML frontmatter for machine-readable fields
- body sections for narrative operating context

### Sync recommendation
Start with:
- **note is primary** for governance/state
- Paperclip mirrors only selected structured fields

Avoid freeform bi-directional sync in the first phase.

### Suggested project note structure
#### YAML frontmatter (machine-readable)
Potential fields:
- `type: paperclip-project-note`
- `project_id`
- `project_slug`
- `title`
- `status`
- `owner_agent`
- `sponsor`
- `priority`
- `decision_mode`
- `approval_required_for`
- `success_metrics`
- `linked_agents`
- `linked_skills`
- `sync_to_paperclip`

#### Body sections (governance + strategy)
Suggested sections:
- Purpose
- Desired Outcome
- Scope
- Out of Scope
- Constraints
- Stakeholders
- Current Strategy
- Active Assumptions
- Risks
- Decisions Log
- Task Routing Rules
- Approval Boundaries
- Current Phase
- Next Coordination Moves

### Project interview skill concept
A future `project interview` skill should:
1. interview Jorge/stakeholders about a new project
2. gather goals, outcomes, constraints, risks, approvals, stakeholders, timelines
3. generate the initial project note
4. link the note to a Paperclip project
5. hand the note to the project manager agent as its operating governance source

This creates an intake → governance → orchestration pipeline.

### How the PM loop could work inside Paperclip
On each wake/run, project manager agent:
1. reads the project note
2. inspects current Paperclip project/task state
3. compares reality vs current plan
4. decides whether to:
   - do nothing
   - create tasks
   - reroute tasks
   - update the note
   - request approval
   - pause the project
5. writes back:
   - note updates
   - project/task status changes
   - escalations if required

### Recommended phased implementation for the next project-note phase
#### Phase 1
- add `projectNotePath` to Paperclip projects
- define canonical markdown template
- define YAML schema
- implement note → project sync for a small structured field set

#### Phase 2
- build project interview skill that outputs the note
- add “create Paperclip project from interview note” workflow

#### Phase 3
- implement PM agent orchestration against the note
- task decomposition/routing
- pause/escalate logic
- decision log updates

#### Phase 4
- smarter sync, validations, drift detection

### Blunt operating principle
If done right, the PM agent becomes:
- explainable
- auditable
- strategically constrained
- operationally useful

If done wrong, it becomes a task bot with management cosplay.

The project note is what prevents that.
- UI/product refinement agreed during live testing: once a skill has been adopted locally, the row should move from a primary `Adopt locally` action into a compact local-management menu (3-dots) exposing at least `Resync from global` and `Remove local override`.
