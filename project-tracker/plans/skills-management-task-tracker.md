# Paperclip × OpenClaw Skills Management — Task Tracker

## Purpose
Local execution tracker for the skills-management implementation phase.

**Source of truth:** this file in the dev repo
**Scope:** global skill visibility, agent assignment/install, precedence clarity, and later-safe policy controls

---

## Phase Goal
Make Paperclip a trustworthy control plane for OpenClaw skills.

That means:
- Paperclip can see global skills
- Paperclip can show which agents effectively have which skills
- operators can assign/install skills without ambiguity
- local vs global precedence is visible
- future allowlist/config edits are deferred until the model is stable

---

## Known facts
- OpenClaw skill precedence is:
  1. `<workspace>/skills`
  2. `~/.openclaw/skills`
  3. bundled skills
  4. optional `skills.load.extraDirs`
- Global skills in `~/.openclaw/skills` are naturally shared machine-wide.
- Agent-local workspace skills shadow global skills of the same name.
- Paperclip already has a skills UI / manager concept, but it does not currently map cleanly onto OpenClaw’s skill-loading model.
- Automatic per-agent visibility controls may require config edits and should be left until last.

---

## Deliverables
- [ ] Define the canonical global skills directory strategy for Paperclip × OpenClaw
- [ ] Make global skills visible in Paperclip skills UI
- [ ] Show source / scope / precedence / health for each skill
- [ ] Support assigning a global skill to a specific agent
- [ ] Support local install/sync of a global skill into agent workspace where needed
- [ ] Show effective skill state per agent (global only / local override / broken / hidden)
- [ ] Define the later safe path for per-agent visibility controls / allowlists

---

## Workstreams

## A. Discovery / current-state trace
- [ ] Inspect Paperclip skill manager data model and storage assumptions
- [ ] Identify where Paperclip downloads/stores skills today
- [ ] Identify how Paperclip currently represents per-agent skill assignment
- [ ] Identify what Paperclip assumes about local vs global install scope
- [ ] Write a concise “current Paperclip skill manager model” note in `project-tracker/research/`

## B. OpenClaw global skill integration design
- [ ] Decide whether `~/.openclaw/skills` is the canonical global directory for this integration
- [ ] Define how Paperclip should discover global skills on disk
- [ ] Define how Paperclip should represent bundled/global/local skills in one model
- [ ] Define how Paperclip should surface precedence/shadowing clearly
- [ ] Write the proposed global-skill integration contract in `project-tracker/plans/`

## C. UI truth model
- [ ] Show all global skills in Paperclip skills UI
- [ ] Add source labels (bundled / global / local)
- [ ] Add health state (ok / missing / broken / dependency issue)
- [ ] Add effective precedence indicator
- [ ] Add per-agent effective visibility panel

## D. Assignment & local install behavior
- [ ] Define assignment semantics vs installation semantics
- [ ] Support assigning a global skill to an agent without immediately copying files unless needed
- [ ] Support local install/sync into `<agent-workspace>/skills`
- [ ] Show whether agent is using global copy or local override
- [ ] Add safe sync/update actions for local copies

## E. Validation & runtime truth
- [ ] Verify assigned skills actually resolve for OpenClaw agents at runtime
- [ ] Detect missing/broken skill files on disk
- [ ] Detect local shadowing of global skills
- [ ] Add an operator-facing identity/effective-state check where useful

## F. Deferred policy controls
- [ ] Design preview-only allowlist/config-diff flow
- [ ] Define how per-agent skill visibility restrictions should map to OpenClaw config safely
- [ ] Leave actual config-writing automation until the visibility/assignment model is stable

---

## Immediate next actions
- [x] Inspect the current Paperclip skills manager implementation end-to-end
- [x] Confirm the canonical on-disk global skills directory choice
- [x] Draft the Paperclip ↔ OpenClaw skills truth model before making any code changes
- [x] Translate the truth model into concrete server/shared/UI implementation tasks
- [x] Decide what existing `company_skills` fields can be reused vs what needs new scope/source metadata
- [ ] Implement discovery for OpenClaw global skills from `~/.openclaw/skills`
- [ ] Implement effective-state computation for local vs global vs bundled resolution
- [ ] Update Paperclip UI to show exists / assigned / effective state separately

## Discovery findings (2026-03-23)
- [x] Verified current Paperclip skill manager is centered on `company_skills` rows and `/companies/:companyId/skills` routes
- [x] Verified current source model supports `local_path`, `github`, `url`, `catalog`, and `skills_sh`
- [x] Verified current project scan already discovers repo/workspace skill roots including `skills/*`, `.agents/skills/*`, `.claude/skills/*`, and related directories
- [x] Verified agent assignment already uses canonical desired skill keys via `paperclipSkillSync.desiredSkills`
- [x] Verified adapter runtime projection already exists via `listRuntimeSkillEntries(...)`
- [x] Confirmed the current model still treats the company skill registry as the center of truth rather than filesystem discovery for OpenClaw

## Truth model decisions (locked unless we find contrary evidence)
- [x] Filesystem is source of truth for OpenClaw skills
- [x] Paperclip DB is catalog/index truth, not existence truth
- [x] Runtime/adapter observation remains separate effective-state truth
- [x] Canonical initial global OpenClaw skills directory: `~/.openclaw/skills`
- [x] Canonical initial local OpenClaw skills directory: `<agent-workspace>/skills`
- [x] Paperclip must model explicit scopes: bundled / global / local / later extra-dir
- [x] Assignment and installation are separate concepts and must stay separate in both model and UI
- [x] Effective state must account for local shadowing of global skills
- [x] Config/allowlist mutation remains deferred until visibility/assignment truth is stable

## G. Truth-model implementation plan
- [x] Add a dedicated truth-model plan doc to `project-tracker/plans/` and keep it updated as implementation changes
- [x] Map current `CompanySkillSourceType` and related shared types against required OpenClaw scope/source semantics
- [x] Define whether `scope` should be a new first-class field distinct from `sourceType`
- [ ] Define how discovered-on-disk skills reconcile with imported/catalog-managed skills
- [ ] Define stable identity rules for `key`, `slug`, `scope`, `sourcePath`, and optional `workspaceId`
- [ ] Define how bundled skills, global skills, and local skills collapse into one effective logical-skill view

## H. Server model refactor
- [ ] Audit `server/src/services/company-skills.ts` for assumptions that DB rows imply canonical existence
- [x] Introduce first-class OpenClaw discovery flow for global skills outside project scans
- [ ] Add scope-aware discovery records for bundled/global/local skills
- [ ] Preserve source metadata for imported/catalog-managed skills without conflating that with OpenClaw scope
- [ ] Define reconciliation/update rules when a previously indexed filesystem skill moves, disappears, or is shadowed
- [ ] Ensure missing-skill pruning logic does not incorrectly remove valid bundled/global observations

## I. Shared types / contract changes
- [x] Extend shared skill types to represent OpenClaw scope separately from source/import provenance
- [x] Add effective-state enums/types for per-agent resolution (`global_only`, `local_overrides_global`, etc. or equivalent normalized labels)
- [ ] Add explicit fields for exists / assigned / effective state where needed
- [ ] Keep backward compatibility where possible for current company-skill routes and UI consumers
- [ ] Update validators/tests for the new truth model

## J. Effective-state engine
- [ ] Compute per-agent effective skill state from discovered local/global/bundled artifacts plus desired assignment
- [ ] Detect local shadowing of global skills by logical identity, not just slug display
- [ ] Distinguish discovered-but-unassigned from assigned-and-effective
- [ ] Distinguish assigned-global from assigned-local from assigned-bundled
- [ ] Surface broken/missing/invalid states cleanly
- [ ] Decide how unmanaged or read-only external states should appear for OpenClaw-backed skills
- [~] In progress: runtime materialization now prefers highest-precedence scope per logical key; next step is explicit effective-state labeling in server snapshots

## N. Current implementation checkpoint (2026-03-23)
- [x] Added truth-model plan doc and expanded task tracker
- [x] Added shared type/validator concepts for `scope`, `truthOrigin`, and agent-skill `effectiveState`
- [x] Added server-side scope/truth inference from metadata
- [x] Added OpenClaw global discovery from `~/.openclaw/skills`
- [x] Updated runtime skill materialization to prefer highest-precedence scope per key
- [x] Added first-pass UI display of scope/truth fields in Company Skills and Agent Skills
- [x] Fixed first UI regression: Company Skills detail pane crashed when `scope`/`truthOrigin` were absent in stale frontend/server state during incremental testing
- [x] Next logical test boundary: OpenClaw agent `/agents/:id/skills` stops using the legacy unsupported branch and returns a native OpenClaw-aware snapshot
- [x] Snapshot source rule: OpenClaw agent skill state must be derived from native OpenClaw roots (workspace `skills/`, `~/.openclaw/skills`, bundled skills) rather than Paperclip-only sidecar locations
- [x] Local adoption/install rule: if a skill is adopted locally for an OpenClaw agent, it must land in that agent workspace’s real `skills/` folder
- [x] Fixed packaging/export regression: openclaw-gateway server entrypoint now re-exports the new skill snapshot handlers so the server can boot
- [ ] Pause for live-instance testing once OpenClaw agent skill snapshots are wired through cleanly

## K. UI truthfulness work
- [ ] Update skills UI to show scope/source labels clearly (`bundled`, `global`, `local`)
- [ ] Show exists / assigned / effective separately instead of one flattened status
- [ ] Show local-overrides-global state explicitly
- [ ] Show which concrete artifact/path is effective for an agent
- [ ] Show when Paperclip is displaying catalog metadata vs observed runtime truth
- [ ] Avoid implying that a company-skill record alone means runtime availability

## L. Assignment and local install behavior
- [ ] Document assignment semantics vs install semantics in code comments and UI copy
- [ ] Ensure assigning a global skill does not automatically imply local copy/install
- [~] Design explicit local install/sync actions from global → local
- [ ] Show whether an agent is using a global copy or a local override
- [ ] Define safe update/sync semantics for local overrides derived from global skills
- [x] Confirm design constraint with Jorge: OpenClaw local skills must use the agent workspace’s real `skills/` folder, not a Paperclip-only workaround path
- [x] Implement first explicit OpenClaw local-adopt/install action writing into `<agent-workspace>/skills/<slug>`
- [x] Add UI action path for adopting a global skill locally for an OpenClaw agent
- [x] Fix first adopt-flow reconciliation bug: local adoption now upserts the adopted local instance using the original logical skill key instead of allowing a duplicate local key insert path
- [x] Improve UI error tracking for adopt flow: add explicit success/error toasts and extend toast lifetime so live testing feedback is readable
- [x] Hide the OpenClaw agent "Adopt locally" action once a skill is no longer just global and has become locally effective
- [x] Fix shared-package export regressions for new adopt-to-agent schema/types so the dev server boots cleanly
- [x] Fix root shared package runtime export for `companySkillAdoptToAgentSchema` so server routes can import the validator value, not just types

## M. Tests and verification
- [x] Add tests for global OpenClaw discovery under `~/.openclaw/skills`
- [x] Add tests for local-overrides-global precedence
- [x] Add tests for bundled fallback when no local/global copy exists
- [x] Add tests for agent effective-state computation across bundled/global/local combinations
- [x] Add UI/state tests for exists / assigned / effective distinctions
- [x] Add regression coverage so current Paperclip-managed catalog flows do not break while adding OpenClaw truth semantics
- [x] Run focused Vitest coverage for company-skills + openclaw-gateway adapter behavior and fix regressions surfaced by the run

## O. Backlog / later investigation
- [ ] Feature request: detect and surface discrepancies where skills exist in an OpenClaw agent workspace `skills/` directory but do not appear in the effective/native OpenClaw skills list
- [ ] Add a diagnostic view or warning for “present on disk but not visible to OpenClaw runtime” cases
- [ ] Investigate likely causes: malformed skill directory shape, missing/invalid `SKILL.md`, casing/path issues, hidden/uninitialized skills, or OpenClaw indexing/refresh behavior
- [ ] Decide whether Paperclip should offer a non-destructive validation check for native OpenClaw skill discoverability
- [ ] Bug: recurring WebSocket/Vite/live-updates connection errors appear on reload (`ws://127.0.0.1:13111` and `/api/companies/:id/events/ws`) even when core UI still works
- [ ] Bug: after successful OpenClaw local adoption, follow-up GET `/api/agents/:id/skills` can return 500 even though the copy/install succeeded

## P. Hardening sequence (current focus)
- [x] Fix post-adopt GET `/api/agents/:id/skills` 500 and harden readback after local adoption
- [x] Harden local/global/effective refresh so agent Skills UI reflects adoption cleanly without transient stale or contradictory state
- [x] Add explicit resync/update semantics for adopted local overrides derived from global skills
- [x] Add explicit remove-local-override action for OpenClaw agents
- [x] Add row action menu (3-dots style) for locally adopted OpenClaw skill management actions

## Q. Verified live behaviors (2026-03-24)
- [x] Global OpenClaw skills are visible in the main Skills page
- [x] OpenClaw agent Skills tab shows native scope/effective state instead of legacy unsupported messaging
- [x] `Adopt locally` copies a global skill into the real agent workspace `skills/<slug>` folder
- [x] Success/error toast feedback is visible and readable during local skill actions
- [x] `Adopt locally` transitions into local-management actions after success
- [x] `Remove local override` deletes only the agent workspace local skill copy and restores global fallback behavior
- [x] `Resync from global` refreshes the local copy successfully
- [x] Removing a local override causes the `Adopt locally` action to reappear

## R. UI/UX cleanup pass (current focus)
- [x] Add clearer visual badges/labels for local override vs global fallback vs bundled
- [x] Improve action copy so local-management menu language is operator-friendly
- [x] Surface install/location state more cleanly in the agent Skills rows
- [x] Tidy small UX rough edges before moving to diff/sync intelligence phase
- [x] Improve badge contrast/visibility in the agent Skills tab

## W. Final polish / phase close-out
- [x] Tighten final provisioning/action copy for OpenClaw human flow
- [x] Add a small note in the phase doc/project note that this phase is being closed with remaining UX ideas as backlog
- [x] Prepare clean handoff summary for next chat/phase

## S. Required Paperclip skills for OpenClaw (discovery / design)
- [x] Inspect why bundled/required Paperclip skills are not currently available to OpenClaw agents
- [x] Decide the correct truth model for required Paperclip skills in OpenClaw: bundled-only, global-synced, local-copied, or hybrid
- [x] Propose the cleanest operator model for making required Paperclip skills reliably available to OpenClaw agents

## T. Required Paperclip skills provisioning phase
- [x] Create dedicated phase note for required Paperclip skills provisioning
- [x] Implement reusable local-install primitive for required Paperclip skills into `<agent-workspace>/skills/<slug>`
- [x] Integrate required skill installation into OpenClaw agent provisioning flow
- [x] Ensure provisioning is idempotent and safe to rerun
- [x] Update agent skill snapshot/UI semantics for required local Paperclip installs
- [x] Add focused tests for required Paperclip skill provisioning + visibility

## U. Provisioning UX follow-up
- [x] Require or strongly gate OpenClaw workspace path during initial provisioning so required skill install location is known up front
- [x] Add explicit re-provision/install-required-skills action in agent settings for OpenClaw agents after workspace path changes
- [x] Prevent silent provisioning success when the OpenClaw workspace path needed for required local installs is missing
- [x] Decide whether initial provisioning should hard-block without workspace path or allow a documented partial provisioning mode
- [x] Clarify the create-agent manual/advanced OpenClaw flow so humans know the workspace root must be set during creation for later native required-skill provisioning
- [x] Fix create-agent OpenClaw config field visibility so workspace root actually appears in create mode
- [x] Persist create-mode OpenClaw workspace root into the created per-agent adapter config reliably
- [x] Gate provisioning on both workspace root and bound native OpenClaw agent id
- [x] Improve per-agent provisioning banner/copy so the next required setup steps are explicit after agent creation
- [x] Replace eager auto-provision-on-create behavior with clearer post-create guidance/toast for the human-driven provisioning workflow

## V. Current status summary (2026-03-24)
- [x] OpenClaw skills truth model implemented and documented
- [x] Global/local/bundled visibility works in Paperclip UI
- [x] OpenClaw agent Skills tab reports native scope/effective state
- [x] Optional local skill lifecycle works: adopt / resync / remove / restore adopt button
- [x] Required Paperclip skills now provision into native local OpenClaw workspace `skills/` paths
- [x] Human-driven advanced/manual agent creation flow + per-agent provisioning flow now work together coherently
- [x] Nice-to-have UX polish/backlog items logged separately without blocking core functionality

## X. UX backlog (logged for later)
- [ ] Add a clearer provisioning-status banner in the per-agent OpenClaw config section that explicitly lists which required fields are still missing before the provision button can run
- [ ] Add question-mark info popovers/help hints next to OpenClaw form fields that currently lack them, matching the existing Gateway URL help pattern
- [ ] Add red asterisk indicators for required OpenClaw provisioning fields until they are filled in

## Y. Next major phase — Paperclip project notes
- [ ] Create a dedicated phase note for Paperclip project-note integration
- [ ] Design the core model: one Paperclip project linked to one canonical markdown project note
- [ ] Define project-note architecture: storage location, file ownership, sync direction(s), and update triggers
- [ ] Define markdown/YAML schema for the project note and which frontmatter fields sync back into Paperclip
- [ ] Decide how Paperclip projects reference linked note paths and how the UI exposes that link
- [ ] Define scripts/tooling required to create, update, validate, and sync project notes
- [ ] Design the project-manager-agent workflow around the project note as governance/source-of-truth
- [ ] Clarify how orchestration decisions/tasks/ownership should flow from the project note into Paperclip tasks and agents

## Z. Company overview + onboarding layer
- [ ] Design a canonical company overview markdown note that explains what the business does, how it is structured, and how agents should navigate company folders/repos
- [ ] Design a core global company onboarding skill that teaches agents how to consume the company overview and operate inside the company repo/folder structure
- [ ] Decide where the company overview should live and who owns maintaining it
- [ ] Decide how this company overview/onboarding layer relates to project notes so company governance and project governance stay distinct but compatible
