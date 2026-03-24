# Phase 1 Data Contract — Native OpenClaw-Linked Paperclip Agent

## Decision
Phase 1 lives entirely inside `openclaw_gateway.adapterConfig`.

No DB/schema change is required for the first slice because:
- Paperclip already persists arbitrary adapter config JSON
- heartbeat already treats adapter config as the execution contract
- the gateway adapter already accepts a target `agentId` and session routing inputs

That keeps the blast radius small and preserves compatibility.

## Minimum Contract
```ts
{
  adapterType: "openclaw_gateway",
  adapterConfig: {
    url: string,
    headers: {
      "x-openclaw-token": string,
    },

    // Phase 1 preferred identity field
    nativeAgentId?: string,

    // Compatibility aliases accepted during transition
    openclawAgentId?: string,
    agentId?: string,

    // Phase 1 preferred session field
    sessionBindingMode?: "main_session" | "dedicated_fixed" | "issue_scoped",

    // Legacy fields still supported
    sessionKeyStrategy?: "fixed" | "issue" | "run",
    sessionKey?: string,

    paperclipApiUrl?: string,
    waitTimeoutMs?: number,
    role?: string,
    scopes?: string[],
    payloadTemplate?: Record<string, unknown>,
  }
}
```

## Runtime Semantics
### Identity routing
- `nativeAgentId` is the preferred field for explicit binding to one native OpenClaw agent.
- `openclawAgentId` and legacy `agentId` are accepted as aliases.
- Adapter resolution order:
  1. `adapterConfig.nativeAgentId`
  2. `adapterConfig.openclawAgentId`
  3. `adapterConfig.agentId`
  4. payloadTemplate equivalents

### Session binding modes
- `issue_scoped`
  - maps to legacy `sessionKeyStrategy: "issue"`
  - session key resolves to `paperclip:issue:<issueId>` when issue id exists
- `main_session`
  - maps to a deterministic fixed lane for one linked native agent
  - default derived key: `paperclip:agent:<nativeAgentId|paperclipAgentId>:main`
- `dedicated_fixed`
  - maps to a deterministic fixed dedicated lane
  - default derived key: `paperclip:agent:<nativeAgentId|paperclipAgentId>:dedicated`

### Overrides
- `sessionKey` remains the explicit override for any fixed-mode session key.
- If `sessionBindingMode` is absent, legacy `sessionKeyStrategy`/`sessionKey` behavior remains in force.

## Why this is the right Phase 1 cut
- zero migration
- minimal code touch
- clean upgrade path
- preserves current onboarding/join flow
- adds a real identity-binding concept without pretending Paperclip already models native OpenClaw fleets

## File slice
- adapter runtime: `packages/adapters/openclaw-gateway/src/server/execute.ts`
- adapter docs: `packages/adapters/openclaw-gateway/src/index.ts`
- adapter UI: `ui/src/adapters/openclaw-gateway/config-fields.tsx`
- tests: `server/src/__tests__/openclaw-gateway-adapter.test.ts`

## Deferred to Phase 2+
- multiple linked native OpenClaw agents per Paperclip company
- discovery/linking UX for native agents
- first-class shared types/validation for the new fields
- join/onboarding UX that emits `nativeAgentId` directly
- richer session topology beyond one bound agent
