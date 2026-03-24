# Investigation Summary — Paperclip × OpenClaw Native Multi-Agent Integration

## Why this exists
Quick local reference for what we already learned so we don’t keep rediscovering the same shit.

---

## Dev Environment Facts
- Dev repo clone: `/home/jorge/dev/paperclip-dev`
- Dev runtime URL: `http://127.0.0.1:3110`
- Dev home/state: `/home/jorge/dev/paperclip-dev-home`
- Separate non-dev Paperclip runtime exists at `127.0.0.1:3100`

## Source-dev issues found
### `pnpm` issue
- `scripts/dev-runner.mjs` spawns `pnpm` directly.
- In this environment, that fails unless `pnpm` is explicitly on PATH.
- Corepack being available is **not enough** for their script as written.

### `plugin-sdk` build issue
- Fresh source startup failed because `@paperclipai/plugin-sdk/dist/index.js` did not exist.
- `packages/plugins/sdk/package.json` exports built `dist/*` files, but install did not build them automatically.
- `pnpm install` produced warnings about missing `paperclip-plugin-dev-server` bins from `dist/dev-cli.js`.
- Manual build of `packages/shared` and `packages/plugins/sdk` was required to get the dev server running.

### Practical local fix used
- bypass broken dev wrapper
- run server directly with `PAPERCLIP_UI_DEV_MIDDLEWARE=true`
- isolate state with a dedicated dev `PAPERCLIP_HOME`

---

## Product / Architecture Findings

## Current Paperclip OpenClaw integration is gateway-centric
Relevant surface:
- `packages/adapters/openclaw-gateway/src/index.ts`
- `server/src/routes/access.ts`

The integration is built around:
- gateway websocket URL
- gateway auth token headers
- join/invite flow
- session strategy config
- Paperclip API URL handoff

This is a runtime transport / onboarding integration, **not** a true native agent-linking model.

## Current integration shape
Paperclip currently expects something like:
- create/invite a Paperclip agent
- set adapter type `openclaw_gateway`
- provide gateway URL + token + config
- then let Paperclip heartbeat wake that adapter-backed Paperclip agent

That is different from:
- discovering existing OpenClaw native agents
- linking them into Paperclip explicitly
- routing tasks to a specific linked native agent
- keeping per-agent session identity clean

## The likely single-lane problem
In `server/src/services/company-portability.ts`, default rules for `openclaw_gateway` include:
- `sessionKeyStrategy: fixed`
- `sessionKey: paperclip`

That strongly suggests default behavior pushes OpenClaw gateway agents into a single shared session lane.

That is likely why the current system feels like:
- invite one OpenClaw thing into Paperclip
- get one Paperclip↔OpenClaw lane
- not a real multi-agent topology

## Heartbeat remains Paperclip-first
Relevant surface:
- `server/src/services/heartbeat.ts`

Paperclip still owns:
- run queueing
- adapter config resolution
- session reuse logic
- execution workspace realization
- runtime invocation
- run logs/status/results

OpenClaw is treated as an adapter/runtime target, not as a first-class peer orchestrator.

---

## Core Gap Statement
Paperclip can talk to OpenClaw Gateway, but it does not currently appear to model **native OpenClaw agent identity** as a first-class concept inside Paperclip.

Missing concept(s):
- bound native OpenClaw agent id
- session binding mode per linked native agent
- multiple linked OpenClaw native agents in one Paperclip company
- clear separation between onboarding/join and runtime orchestration

Without those, everything collapses into gateway config + session key behavior.

---

## Working Hypothesis
Phase 1 should introduce a real binding layer for **one** native OpenClaw-linked Paperclip agent.

Probable minimum contract shape:
- native OpenClaw agent id
- session binding mode:
  - `main_session`
  - `dedicated_fixed`
  - `issue_scoped`
- explicit session strategy / session key behavior
- runtime path that routes by native agent identity first

Only after that should we expand to multiple linked native agents.

---

## Adapter/runtime contract trace
### Adapter execution contract (`packages/adapters/openclaw-gateway/src/server/execute.ts`)
- Required runtime input is still `adapterConfig.url`; auth is derived from `headers`, `authToken`, or `password`.
- Runtime transport is pure gateway websocket; HTTP join/onboarding fields do not participate in execution.
- The adapter already supported targeting a specific native OpenClaw agent through `agentId` in either config or payload template.
- Session identity is computed inside the adapter, not in heartbeat. Heartbeat only passes Paperclip run/task/issue context plus prior Paperclip runtime session state.
- The adapter emits the gateway request with:
  - `message`
  - `sessionKey`
  - `idempotencyKey`
  - optional `agentId`
  - optional payload template extras
- Result metadata already supports runtime-service passthrough via `meta.runtimeServices`, plus normal summary/error status handling.

### Heartbeat/runtime integration points (`server/src/services/heartbeat.ts`)
- Heartbeat remains the orchestrator: it resolves workspace, runtime config, secrets, logs, status, cost, and run lifecycle.
- For OpenClaw, heartbeat does **not** compute target native agent identity or session key. It simply passes adapter config and run context into `adapter.execute(...)`.
- That means the safest Phase 1 extension point is the gateway adapter itself, not heartbeat schema churn.
- Session reuse inside heartbeat is about Paperclip-side adapter session state. OpenClaw gateway session routing is a separate downstream concern handled by adapter-generated `sessionKey`.

### Join/bootstrap trace (`server/src/routes/access.ts`)
- Invite/join flow is onboarding-only plumbing for creating/updating a Paperclip agent record configured for `openclaw_gateway`.
- Join normalization validates gateway URL/token, optionally generates a device key, and preserves session config fields.
- Approval creates a normal Paperclip agent with `adapterType=openclaw_gateway` and stores the normalized JSON under `adapterConfig`.
- Nothing in join/bootstrap currently models a first-class native OpenClaw agent link; it just stores gateway transport config.

## Phase 1 implementation conclusion
- We do **not** need a schema change for Phase 1.
- The minimum viable contract can live inside `adapterConfig` with:
  - `nativeAgentId`
  - `sessionBindingMode`
  - backward-compatible alias support for legacy `agentId` and session fields
- That creates an explicit one-agent binding without breaking existing gateway users.

## Immediate Focus
1. finish tracing adapter contract in full
2. finish tracing access/join flow in full
3. trace exact adapter execution invocation path in heartbeat
4. design Phase 1 data contract
5. design file-by-file implementation slice
