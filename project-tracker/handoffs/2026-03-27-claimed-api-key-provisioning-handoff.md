# Handoff — Claimed API Key Provisioning Source-of-Truth Fix

## Status
Ready to implement.

## Immediate Goal
Fix the OpenClaw Paperclip provisioning flow so the generated `claimed-api-key.json` is driven by the effective per-agent config values, with the per-agent config acting as the source of truth.

Right now the remaining bug is that provisioning can still write:
- `apiUrl` in `claimed-api-key.json` from the server/default base URL instead of the saved per-agent override
- potentially other payload fields from provisioning-local defaults instead of the effective saved adapter config

## Repo / Branch
- Repo: `k4-br0n/paperclip-dev-private`
- Local clone: `/home/jorge/dev/paperclip-dev`
- Branch: `k4br0n/live`

## Relevant Issues
- Closed: #3 — malformed OpenClaw gateway URL (`/18789` vs `:18789`) caused the `127.0.0.1:80` failure; not a runtime bug.
- Open: #4 — provisioning still drifts from saved per-agent config for `paperclipApiUrl` / claimed key output.
- New feature request to add malformed URL detection should be tracked separately from #4.

## Already Landed
Commit already created to preserve the working dev/stable flow:
- `c96e9461` — `fix(runtime): preserve working Paperclip dev/stable promotion flow`

That commit already includes a partial fix:
- UI no longer blindly overwrites `paperclipApiUrl` after provisioning when an override already exists.
- Provisioning service no longer blindly rewrites `adapterConfig.paperclipApiUrl` when one is already saved.

## Remaining Bug
The generated claimed key file still contains a default/local `apiUrl`, e.g.:

```json
{
  "token": "pcp_...",
  "keyId": "...",
  "keyName": "telos-openclaw-3",
  "agentId": "d4de25b2-25d0-4471-a961-89658f83405e",
  "apiUrl": "http://127.0.0.1:3110/api",
  "createdAt": "2026-03-27T04:26:59.300Z"
}
```

Jorge wants this file controlled by the per-agent config fields as the source of truth.

## Required Behavior
Resolve one effective provisioning payload from the saved per-agent config, then use it consistently.

### Resolution order
For any field emitted into `claimed-api-key.json`:
1. explicit saved per-agent config value
2. otherwise server/default fallback

### At minimum this applies to
- `apiUrl`
- any other values currently duplicated between per-agent config and claimed-key payload contract
- token/key id/name are still created by provisioning, but the payload shape should remain intentionally consistent with the config-backed contract

## Files to Inspect First
- `server/src/services/openclaw-paperclip-provisioning.ts`
  - `buildKeyPayload(...)`
  - payload construction in `provisionForAgent(...)`
  - where `input.paperclipBaseUrl` is still used directly
- `ui/src/adapters/openclaw-gateway/config-fields.tsx`
  - post-provision refresh behavior
- any OpenClaw-side loader/consumer that reads `claimed-api-key.json`
  - ensure the payload contract still matches actual consumption expectations

## Likely Refactor
Introduce an explicit resolver for the effective claimed-key payload inputs, something like:
- `resolveEffectivePaperclipApiUrl(adapterConfig, defaultBaseUrl)`
- optionally a broader `resolveClaimedKeyPayloadInputs(adapterConfig, defaults, createdKey)` helper

Then use the resolved value in exactly one place for:
- file payload write
- returned provisioning result payload
- persisted adapter config (when missing)
- UI refresh expectations

## Guardrails
- Do not let provisioning stomp an explicit saved per-agent override.
- Do not create a second source of truth separate from adapter config.
- Keep this separate from malformed OpenClaw gateway URL detection work.
- Preserve backward compatibility for agents with no explicit override.

## Suggested Validation
1. Set per-agent `paperclipApiUrl` to non-default value.
2. Save.
3. Run provisioning.
4. Confirm:
   - form field remains unchanged
   - persisted agent config remains unchanged
   - generated `claimed-api-key.json` uses that exact saved value
5. Re-test agent with no explicit override.
6. Confirm default fallback still works.

## Nice Follow-Up
Add a small regression test covering:
- explicit override survives provisioning
- claimed-key payload uses override when present
- fallback uses default only when override absent
