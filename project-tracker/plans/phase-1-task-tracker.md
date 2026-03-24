# Paperclip × OpenClaw Native Multi-Agent Integration — Phase 1 Task Tracker

> Status: completed Phase 1 dev slice. Kept for historical reference; use the skills-management tracker for the next phase.

## Purpose
Local execution tracker for the first implementation phase.

**Source of truth:** this file in the dev repo
**Big Brain visibility link target:** symlink this file into Big Brain so Jorge can track it without making Big Brain the working copy.

---

## Phase 1 Goal
Get a **single native OpenClaw-linked Paperclip agent path** working cleanly enough to prove the architecture.

This phase is **not** full multi-agent orchestration yet.
This phase is:
- one Paperclip agent
- one mapped native OpenClaw agent
- one reliable session-binding mode
- one successful wake/run/result loop
- enough modular structure that we can extend to many agents later

---

## Current Known Facts

### Confirmed about the current Paperclip model
- Paperclip already has an `openclaw_gateway` adapter.
- Current integration is built around **invite/join** + **gateway config**, not around linking an existing fleet of native OpenClaw agents.
- Current join flow expects `agentDefaultsPayload` with fields like:
  - `url`
  - `headers.x-openclaw-token`
  - `paperclipApiUrl`
  - `sessionKeyStrategy`
- Current portability defaults for `openclaw_gateway` set:
  - `sessionKeyStrategy: fixed`
  - `sessionKey: paperclip`
- That default strongly biases the system toward a **single shared session lane**, which is the opposite of what we want.
- Heartbeat/run orchestration remains Paperclip-first: Paperclip decides when an agent runs and the adapter acts as runtime transport.

### Confirmed local setup issues
- Upstream `master` source-dev is not cleanly bootable as-is.
- `scripts/dev-runner.mjs` hardcodes `pnpm` and fails if it is not directly on PATH.
- `packages/plugins/sdk` must be built manually in fresh source-dev for the server to start cleanly.
- Current dev instance is running at `http://127.0.0.1:3110`.

### Core product gap
Paperclip does **not** currently appear to model:
- native OpenClaw agent identity as a first-class field
- per-native-agent session binding strategy
- discovery/linking of multiple existing OpenClaw agents into one Paperclip environment
- a clean separation between OpenClaw onboarding and OpenClaw runtime orchestration

---

## Phase 1 Deliverables
- [x] Document the current adapter/runtime contract precisely
- [x] Define the minimum new config contract for a native OpenClaw-linked Paperclip agent
- [x] Identify the smallest set of files to change for a single-agent implementation slice
- [x] Implement that slice in a modular way
- [ ] Validate it against the dev instance
- [ ] Produce a porting checklist for the working Paperclip instance

---

## Workstreams

## A. Environment & Developer Workflow Hardening
- [ ] Create a local bootstrap note describing exact commands required to run Paperclip source-dev reliably
- [ ] Capture `pnpm` PATH issue in local research notes
- [ ] Capture `plugin-sdk` missing dist/build issue in local research notes
- [ ] Decide whether to patch local dev boot scripts or keep a wrapper command for development
- [ ] Confirm the dev runtime remains stable on port `3110`

## B. Adapter Contract Trace
- [ ] Read the full `packages/adapters/openclaw-gateway/src/index.ts`
- [ ] Identify all runtime inputs expected by the adapter
- [ ] Identify all result metadata the adapter is expected to return
- [ ] Identify where session identity is computed and passed through
- [ ] Identify whether the adapter currently has any concept of targeting a specific native OpenClaw agent
- [ ] Write a concise “current adapter contract” summary note in `project-tracker/research/`

## C. Invite / Join / Bootstrap Trace
- [ ] Read the full OpenClaw-related sections in `server/src/routes/access.ts`
- [ ] Map the current OpenClaw invite prompt generation flow
- [ ] Map the join request acceptance / replay behavior
- [ ] Identify exactly what onboarding artifacts OpenClaw is expected to receive
- [ ] Identify what parts of the current join flow are onboarding-only and should not leak into runtime orchestration design
- [ ] Write a concise “current join/bootstrap flow” summary note in `project-tracker/research/`

## D. Runtime / Heartbeat Trace
- [ ] Trace how Paperclip heartbeat resolves adapter config and runtime config
- [ ] Trace how Paperclip loads session state for a run
- [ ] Trace where adapter execution is invoked from heartbeat
- [ ] Identify where adapter-specific session routing can be extended safely
- [ ] Identify what assumptions in heartbeat currently collapse OpenClaw into a generic runtime lane
- [ ] Write a concise “heartbeat/runtime integration points” summary note in `project-tracker/research/`

## E. Data Model / Identity Mapping Design
- [ ] Decide whether Phase 1 can live fully inside `adapterConfig` / `runtimeConfig`
- [ ] If yes, draft the minimal config shape for native OpenClaw linkage
- [ ] If no, identify the minimal schema change needed
- [ ] Define fields for:
  - [ ] native OpenClaw agent id
  - [ ] session binding mode (`main_session`, `dedicated_fixed`, `issue_scoped`)
  - [ ] explicit session key / strategy behavior
  - [ ] future room for multiple linked agents
- [ ] Write the proposed data contract note in `project-tracker/plans/`

## F. Modular Architecture Design
- [ ] Define the runtime provider boundary for OpenClaw-native execution
- [ ] Separate onboarding/join responsibilities from runtime responsibilities
- [ ] Decide whether to evolve `openclaw_gateway` or introduce a new adapter type / mode
- [ ] Identify which logic belongs in:
  - [ ] adapter package
  - [ ] server service module(s)
  - [ ] shared validation/types
  - [ ] UI layer
- [ ] Write a “Phase 1 architecture slice” note in `project-tracker/plans/`

## G. Implementation Plan
- [ ] Convert the architecture decision into a file-by-file implementation checklist
- [ ] Order changes to minimize churn and breakage
- [ ] Define how success will be tested locally
- [ ] Define rollback/safety plan for failed implementation attempts

## H. Implementation
- [x] Implement minimal config contract for one native OpenClaw-linked agent
- [x] Implement runtime routing so Paperclip targets a specific native OpenClaw agent identity
- [x] Implement initial session binding mode support
- [x] Preserve compatibility with the existing OpenClaw gateway flow where possible
- [ ] Add or update validation/types
- [x] Add tests where feasible without boiling the ocean

## I. Validation
- [x] Run the dev instance after changes
- [x] Verify the Paperclip agent can link to one intended native OpenClaw agent
- [x] Verify a run can be started
- [x] Verify session behavior matches the chosen binding mode
- [ ] Verify logs/result/status flow back into Paperclip
- [x] Record actual behavior vs expected behavior in `project-tracker/logs/`

## Current status update — 2026-03-23
- Implemented Phase 1 adapter-side contract without schema churn.
- Added preferred config aliases:
  - `nativeAgentId`
  - `openclawAgentId` (compat alias)
  - `sessionBindingMode`
- Added adapter runtime mapping:
  - `main_session` -> deterministic fixed lane per bound native agent
  - `dedicated_fixed` -> deterministic dedicated fixed lane per bound native agent
  - `issue_scoped` -> existing per-issue behavior
- Preserved legacy behavior when `sessionBindingMode` is absent:
  - `sessionKeyStrategy`
  - `sessionKey`
  - legacy `agentId`
- Updated adapter docs and UI fields to expose the Phase 1 contract.
- Added adapter tests covering explicit native-agent binding and issue-scoped/main-session routing.
- Live validation progressed further than expected: Paperclip successfully dispatched a run to native OpenClaw agent `main` using the new `main_session` binding mode.
- Effective live session key was `paperclip:agent:main:main`, confirming native-agent-specific lane routing is active.
- Current remaining blocker is OpenClaw-side Paperclip API auth/bootstrap, not adapter routing.
- The agent-side runtime looked for a claimed key file at `~/.openclaw/workspace/paperclip-claimed-api-key.json` and could not load `PAPERCLIP_API_KEY`.
- Fixed in adapter source: wake/bootstrap text now explicitly prefers already-set `PAPERCLIP_API_KEY` and `PAPERCLIP_API_URL`, supports configurable `paperclipClaimedApiKeyPath`, and treats `~/.openclaw/workspace/paperclip-claimed-api-key.json` as a documented legacy compatibility fallback only.
- Added regression coverage for the new wake-text/bootstrap precedence and legacy fallback behavior.
- Validation passed for targeted OpenClaw gateway adapter tests and adapter package typecheck.
- Direct dev-instance auth check confirmed the Paperclip agent API key works against `GET /api/agents/me` on the dev instance and resolves correctly to the `Telos (dev)` agent record.
- Jorge observed the live run itself was not failing in the way I initially inferred; key correction: the remaining uncertainty is OpenClaw-side runtime behavior/observability, not confirmed Paperclip-side token invalidity.
- Added follow-up UI delivery: exposed `paperclipClaimedApiKeyPath` as a visible agent-config field so operators can set custom claimed-key file locations without raw config editing.
- Added follow-up UI delivery: exposed `openclawWorkspaceRoot` as a visible agent-config field, plus resolved-path preview and copy/open helpers for the mapped OpenClaw workspace.
- Added server-backed provisioning endpoint for agent-scoped Paperclip keys and wired a config-panel button to it.
- Provisioning now emits Paperclip toast-card feedback for started/success/error states instead of failing silently.
- Provisioning now validates that the configured OpenClaw workspace root exists and is a directory before writing the claimed key file.
- Provisioned key names now use the pattern `<agent>-openclaw-<n>` so operators can identify owner + sequence at a glance.
- Added config-panel `Test Paperclip identity` action that checks the stored claimed key against `GET /api/agents/me` and reports the resolved Paperclip agent via a toast card.
- Live validation now confirms the provisioning/identity slice is working end-to-end for Phronesis in the dev instance:
  - agent-scoped provisioning succeeds
  - claimed key is stored in the mapped OpenClaw workspace
  - provisioning toasts/reporting behave correctly
  - `Test Paperclip identity` resolves the stored key to `Phronesis`
  - example validated key name: `phronesis-openclaw-1`
- Phase 1 is now effectively complete for the per-agent binding + per-agent credential separation slice in dev.
- Remaining end-to-end gap: run a full Paperclip issue/task cycle through Phronesis and confirm the resulting comments/actions stay attributed to Phronesis throughout execution, not Telos.

## J. Portability / Working-Instance Readiness
- [ ] Identify what local hacks are just dev-environment hacks vs real product changes
- [ ] Create a clean patch/port checklist for the working instance
- [ ] Note any config migrations or operator instructions needed later

---

## Risks / Watchouts
- Paperclip’s current architecture is Paperclip-orchestrator-first; trying to jam native OpenClaw semantics in too early may create adapter spaghetti.
- The `openclaw_gateway` adapter may be too gateway-transport-specific to cleanly represent native OpenClaw agent identity without either:
  - a new mode, or
  - a new adapter type.
- Default fixed session behavior is dangerous for multi-agent identity separation.
- If we skip modular boundaries now, porting to the working instance will be a mess.

---

## Current Working Hypothesis
The first successful implementation slice should likely be:
- one Paperclip agent record
- explicit binding to one native OpenClaw agent id
- a chosen session mode of **main session** or **dedicated fixed session**
- adapter/runtime execution updated to route by native agent identity first

That proves the concept without prematurely solving the whole multi-agent swarm problem.

---

## Definition of Done for Phase 1
Phase 1 is done when:
- Paperclip can target one specific native OpenClaw agent intentionally
- that linkage is explicit in config / mapping, not implied by a generic shared session
- a Paperclip run can execute against that linked native agent
- session behavior is understandable and repeatable
- the implementation is modular enough to extend to multiple linked agents next
