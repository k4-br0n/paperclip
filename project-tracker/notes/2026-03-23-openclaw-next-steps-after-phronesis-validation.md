# OpenClaw next steps after Phronesis validation

Date: 2026-03-23
Status: completed follow-through note

## Decisions

### 1) Private backup repo
Create a separate private backup repo from the full safe working copy, not from the public snapshot branch.

Why:
- the current working tree includes local-only material (`.env.devlocal`, `project-tracker/`, and other non-public context)
- the issue explicitly says not to expose local dev secrets, claimed keys, or project-tracker internals
- a private backup should preserve the full working state without forcing premature cleanup for public consumption

Recommendation:
- make a private remote dedicated to full-fidelity backups
- push the current development branch there after a secret/path scrub pass
- keep the public fork branch code-only until the upstream split is ready

### 2) Public PR decision
Do **not** open a public PR yet.

Why:
- the current branch is a useful snapshot, but it mixes validation-era changes with local/private workflow context
- the upstream repo should get a clean patch series, not a raw dev-state dump
- holding the PR until the patch split is prepared reduces review noise and lowers leak risk

Recommendation:
- keep the already-pushed public branch as a documented code snapshot only
- open PRs only after splitting the work into reviewable upstream chunks

### 3) Upstreamable patch split
Prepare the Paperclip core changes as four reviewable buckets:

1. **OpenClaw gateway adapter hardening**
   - gateway adapter config validation
   - pairing/default auth behavior
   - better operator-visible failure messages

2. **Invite/onboarding flow**
   - controlled invite prompt generation
   - join flow polish
   - docs + tests for the onboarding path

3. **Issue/task execution reliability**
   - checkout/lock behavior
   - retry semantics around wake-triggered runs
   - explicit run attribution checks

4. **Docs and smoke harness**
   - onboarding checklist
   - docker smoke flow
   - validation steps for manual issue, message tool, and new-session creation

This keeps core runtime changes separate from docs/demo scaffolding and makes upstream review sane.

### 4) Phronesis onboarding template
Use Phronesis as the reference onboarding template for additional OpenClaw agents.

Template shape:
- adapter type: `openclaw_gateway`
- session binding: stable main-session or issue-scoped binding, chosen intentionally
- persisted device key enabled by default
- gateway URL must be `ws://` or `wss://`
- non-placeholder gateway token
- invite flow via generated prompt, not hand-written onboarding text
- first-task validation sequence:
  1. comment-only task
  2. message-tool + comment task
  3. create-new-issue task from a fresh session

Minimum rollout checklist for future agents:
- confirm gateway token length is non-trivial
- confirm `devicePrivateKeyPem` is present
- confirm `disableDeviceAuth` is false/absent
- confirm first retry after wake preserves agent attribution
- confirm comments/messages are authored by the mapped Paperclip agent

### 5) Real task cycle validation
A fresh issue cycle should be executed through the documented `/api/issues` endpoints, assigned to the mapped OpenClaw agent, then completed with:
- checkout
- comment
- mark done

Success criteria:
- issue reaches `done`
- comment is authored under the mapped agent identity
- the run stays attributable to the mapped OpenClaw agent end-to-end

## Outcome for DIG-6
The right move is:
- private backup repo: yes
- public PR now: no
- upstream split: yes, four buckets above
- Phronesis template: yes, as the rollout baseline
- attribution retest: run one documented issue cycle and record the result in the issue comment/history
