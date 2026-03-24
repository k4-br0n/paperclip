# OpenClaw Required Skills Provisioning Phase

## Purpose
Define and implement how Paperclip-required skills become **natively available** to OpenClaw agents.

This phase starts from a now-working Paperclip × OpenClaw skill management base:
- global/local skills discovery works
- OpenClaw agent skill snapshot works
- local adopt/remove/resync lifecycle works
- UI and focused regression coverage exist

What remains unresolved is Paperclip’s own **required/bundled** skills for OpenClaw agents.

---

## Problem
Paperclip currently marks some skills as required/bundled and includes them in runtime skill projections.

That is enough for Paperclip-managed local adapters, but **not enough for OpenClaw agents**.

For OpenClaw:
- a skill is not truly available unless it exists in a native OpenClaw skill root
- merely labeling a skill as `required` in Paperclip’s snapshot does not make the OpenClaw runtime able to use it

So today the system can truthfully show global/local OpenClaw skills, but Paperclip-required skills remain only conceptually required, not natively provisioned.

---

## Decision
For OpenClaw agents, Paperclip-required skills should be provisioned as **Paperclip-owned local installs** inside the real agent workspace skill root:

- target path: `<agent-workspace>/skills/<slug>`
- ownership: Paperclip-managed / effectively read-only from the operator’s perspective
- precedence: native OpenClaw local precedence
- install timing: during/after Paperclip provisioning for an OpenClaw agent

This avoids fake bundled magic and avoids relying on a shared global directory as the primary required-skill delivery path.

---

## Why local-first is the right model
### 1. Native correctness
OpenClaw will actually see and use the skills because they live in a native local skill root.

### 2. Deterministic availability
No dependency on whether `~/.openclaw/skills` happens to contain the right Paperclip defaults.

### 3. Clean ownership
Paperclip remains source-of-truth owner of the built-in required skills, but OpenClaw consumes them through its normal filesystem model.

### 4. Predictable precedence
Local required installs cleanly override global copies when necessary.

### 5. Provisioning ergonomics
When Jorge finishes manual provisioning, the agent should already have the required Paperclip skills present in its workspace `skills/` directory.

---

## Operator model
Required Paperclip skills for OpenClaw agents should behave differently from optional skills.

### Required Paperclip skills
- auto-installed locally for OpenClaw agents
- shown as required + local in the UI
- not removable via the normal “remove local override” action
- refresh/update controlled by Paperclip

### Optional OpenClaw skills
- can be adopted locally from global
- can be removed locally
- can be refreshed from global
- continue using the normal lifecycle already built

---

## Provisioning requirement
When a new OpenClaw agent is provisioned through Paperclip, required Paperclip skills should also be materialized into:
- `<agent-workspace>/skills/<slug>`

This should happen as part of the provisioning path rather than relying on a later manual click-by-click follow-up.

---

## Proposed implementation sequence
### Phase A — required local materialization primitive
- add a reusable service path that installs Paperclip-required skills into an OpenClaw agent workspace `skills/` directory
- distinguish required installs from optional local adoptions in metadata

### Phase B — provisioning integration
- hook required-skill local installation into the OpenClaw agent provisioning flow
- make provisioning idempotent and safe to rerun

### Phase C — UI truthfulness
- required Paperclip skills should show as local + required for OpenClaw agents when provisioned
- required skills should not expose the optional local-management removal action
- required skills may expose a controlled refresh/update path later if needed

### Current implementation checkpoint
- provisioning path now installs required Paperclip skills into the real OpenClaw agent workspace `skills/` directory
- OpenClaw agent snapshot now treats required Paperclip skills copied into the workspace as required/local installs instead of optional local overrides
- UI semantics now avoid exposing the optional local-management menu for required Paperclip installs
- focused test slices rerun successfully after these changes
- next UX closure: if the manual create-agent flow already has the OpenClaw workspace root, automatically run Paperclip provisioning immediately after create so humans do not have to perform a second separate setup step
- initial attempt used eager auto-provision after create, but live feedback clarified the better operator flow: create should persist the OpenClaw workspace root, then the human should complete per-agent setup and explicitly provision Paperclip access/required skills from the config page once both workspace root and bound native OpenClaw agent id are set
- bug found and fixed: the create-mode OpenClaw form was still hiding the workspace-root field because it lived under a `!isCreate` guard, so the manual/advanced create surface could never actually collect the path needed for immediate provisioning
- remaining bug/UX task: create-mode still is not reliably persisting `openclawWorkspaceRoot` into the created per-agent adapter config, so the post-create settings screen does not reflect the entered value yet
- next UX requirement: provisioning button should be gated on both workspace root and bound native OpenClaw agent id, with clearer per-agent banners telling the human exactly what is still missing before provisioning can run
- implemented: per-agent provisioning UI now gates on both workspace root and bound native OpenClaw agent id, shows explicit next-step banners, and create-agent flow now gives a clearer post-create toast telling the human what to do in the config page next

### Phase D — tests
- provisioning installs required Paperclip skills into the native local workspace path
- rerunning provisioning does not duplicate or corrupt installed required skills
- required skills appear correctly in the OpenClaw agent skill snapshot
- required skills are not treated like optional removable overrides

---

## Open questions
1. Should required Paperclip skills be refreshed automatically on every provisioning rerun, or only installed when missing?
   - current lean: install-if-missing first; explicit refresh semantics later if needed

2. Should the UI visually distinguish Paperclip-required local installs from user-adopted local overrides?
   - current lean: yes, via badges/labels

3. Should Paperclip-required skills ever be promoted into global OpenClaw skills automatically?
   - current lean: no, not in this phase

4. How should provisioning behave when the OpenClaw workspace path is missing?
   - new lean after live discussion: both capture workspace path early during provisioning **and** expose a later re-provision/install-required-skills action after config edits
   - also avoid silent false-success when the required install location is unknown
   - note: the create-agent manual/advanced form is a different surface from the post-create per-agent settings view, so creation-time workspace guidance must be explicit there too

---

## Success criteria
This phase is successful when:
- an OpenClaw agent provisioned via Paperclip gets required Paperclip skills installed into its real local `skills/` folder
- the OpenClaw runtime can actually use those skills natively
- the agent Skills tab reports those required skills truthfully as local/required
- operators cannot accidentally treat required Paperclip installs like optional local overrides

## Current status
This phase is effectively standing up successfully after live testing.

Validated outcomes:
- required Paperclip skills can be provisioned into native local OpenClaw workspace paths
- provisioning is tied coherently to the human-driven per-agent config flow
- provisioning is gated on the right prerequisites (workspace root + native agent id)
- required local Paperclip installs appear with the correct semantics in the Skills UI

What remains here is mostly UX polish/backlog follow-up, not core capability risk.

## Phase close-out
This phase can be treated as functionally complete.

Closed scope:
- Paperclip required skills for OpenClaw are no longer merely conceptual/bundled labels
- they now have a native local provisioning path
- the human configuration flow supports provisioning/re-provisioning coherently
- required local installs are represented truthfully in the UI

Deferred to later/backlog:
- extra UX polish ideas
- diagnostics for disk-vs-runtime mismatch cases
- smarter diff/sync intelligence for local overrides vs global source changes
- provisioning-status banner in per-agent OpenClaw config that explicitly lists missing prerequisites before provisioning can run
- question-mark help popovers on OpenClaw form fields that currently lack inline help
- red asterisk indicators on required OpenClaw provisioning fields until they are filled in
