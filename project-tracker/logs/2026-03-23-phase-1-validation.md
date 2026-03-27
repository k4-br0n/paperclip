# 2026-03-23 Phase 1 Validation

## Code-level validation
- `corepack pnpm vitest run server/src/__tests__/openclaw-gateway-adapter.test.ts`
- Result: passed (`9/9` tests)
- Added coverage for:
  - explicit native OpenClaw agent binding via `nativeAgentId`
  - `main_session` deterministic session routing
  - `issue_scoped` routing compatibility

## Adapter package validation
- `corepack pnpm --filter @paperclipai/adapter-openclaw-gateway typecheck`
- Result: passed

## Dev runtime validation
- Restarted repo dev server on port `3110` using `.env.devlocal`
- Startup log: `/tmp/paperclip-dev-3110.log`
- Confirmed listener: `127.0.0.1:3110`
- Confirmed HTTP response: `200 OK`
- Server mode: `vite-dev-middleware`
- API base: `http://127.0.0.1:3110/api`

## What this validates
- Phase 1 adapter contract compiles
- new runtime routing behavior is covered by tests
- local dev instance is up after the changes

## Live validation update — native agent binding test
- Paperclip dev UI was successfully used to create an `openclaw_gateway` agent bound to native OpenClaw agent `main`.
- Adapter-side Phase 1 routing succeeded live:
  - Paperclip connected to the OpenClaw gateway
  - targeted `nativeAgentId: "main"`
  - selected session lane using `sessionBindingMode: "main_session"`
  - effective session key was logged as `paperclip:agent:main:main`
- This confirms the new binding/session-mode slice is working structurally in a real run, not just unit tests.
- The run did **not** complete functionally because the OpenClaw-side Paperclip skill/auth bootstrap was incomplete.
- Runtime error indicated the agent could not find the expected claimed key file and therefore could not load `PAPERCLIP_API_KEY`.

## Auth/bootstrap fix validation
- Patched `packages/adapters/openclaw-gateway/src/server/execute.ts` so wake/bootstrap guidance now:
  - prefers explicit `PAPERCLIP_API_KEY` already present in the OpenClaw run context
  - prefers explicit `PAPERCLIP_API_URL` already present in the OpenClaw run context
  - supports configurable `paperclipClaimedApiKeyPath`
  - only falls back to `~/.openclaw/workspace/paperclip-claimed-api-key.json` as a legacy compatibility path
- Updated adapter docs/help text in:
  - `packages/adapters/openclaw-gateway/src/index.ts`
  - `packages/adapters/openclaw-gateway/README.md`
- Added regression tests in `server/src/__tests__/openclaw-gateway-adapter.test.ts` for:
  - explicit env-first bootstrap guidance
  - configurable claimed-key path guidance
  - legacy fallback path guidance
- Validation commands:
  - `corepack pnpm vitest run server/src/__tests__/openclaw-gateway-adapter.test.ts` → passed (`11/11` tests)
  - `corepack pnpm --filter @paperclipai/adapter-openclaw-gateway typecheck` → passed

## WebSocket :80 regression investigation — 2026-03-27
- Added targeted instrumentation to the OpenClaw gateway test-environment path in:
  - `server/src/routes/agents.ts`
  - `packages/adapters/openclaw-gateway/src/server/test.ts`
- Route logging now captures:
  - input adapter URL
  - normalized adapter URL
  - resolved runtime adapter URL
  - input/runtime `paperclipApiUrl`
  - runtime header keys
- Adapter probe logging now captures:
  - exact URL passed into `new WebSocket(...)`
  - parsed protocol / hostname / port / pathname
  - websocket error message on failure
- Important dev-runtime finding: the Paperclip server imports `@paperclipai/adapter-openclaw-gateway/server` from built package `dist`, so source edits in `src/server/test.ts` do not take effect until the adapter package is rebuilt.
- Rebuilt adapter package with:
  - `corepack pnpm --filter @paperclipai/adapter-openclaw-gateway build`
- Current leading hypothesis after direct library inspection/instrumentation:
  - raw `ws` URL parsing itself is behaving correctly for `ws://127.0.0.1:18789`
  - the reported `ECONNREFUSED 127.0.0.1:80` is likely introduced by a higher-level runtime/config/proxy path or misleading error-reporting boundary, not by basic `ws` URL parsing
- Next validation step: reproduce `Test environment` against the rebuilt dev runtime and inspect the new route + adapter probe logs to see whether the runtime URL reaching the adapter is still correct at the moment of failure.

## Regression closure — 2026-03-27 04:49 UTC
- The `ECONNREFUSED 127.0.0.1:80` path is **closed** as operator input error (PEBCAK), not adapter/runtime corruption.
- Jorge confirmed the gateway URL entered in the form used a forward slash form (`ws://127.0.0.1/18789`) instead of the correct port form (`ws://127.0.0.1:18789`).
- Reproduction verified directly:
  - `ws://127.0.0.1:18789` parses with port `18789` and passes the gateway probe.
  - `ws://127.0.0.1/18789` parses as host `127.0.0.1`, path `/18789`, implicit port `80`, and fails exactly with `connect ECONNREFUSED 127.0.0.1:80`.
- The active dev instance is now working as expected once the URL was corrected.
- Follow-up requested: add stronger UI/runtime error detection for malformed OpenClaw gateway URLs so slash-vs-port mistakes are caught before save/test.

## What remains unvalidated end-to-end
- successful Paperclip API auth from the OpenClaw agent side during a live run with explicit env/config actually supplied
- actual live wake/run/result completion against a real native OpenClaw agent after this auth/bootstrap fix
- real session continuity observed through the gateway using each binding mode
- Paperclip UI roundtrip for editing/saving the new fields in a browser session across restarts
- malformed-but-parseable OpenClaw gateway URLs should be detected more aggressively before save/test (planned hardening)
