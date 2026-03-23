export const type = "openclaw_gateway";
export const label = "OpenClaw Gateway";

export const models: { id: string; label: string }[] = [];

export const agentConfigurationDoc = `# openclaw_gateway agent configuration

Adapter: openclaw_gateway

Use when:
- You want Paperclip to invoke OpenClaw over the Gateway WebSocket protocol.
- You want native gateway auth/connect semantics instead of HTTP /v1/responses or /hooks/*.

Don't use when:
- You only expose OpenClaw HTTP endpoints.
- Your deployment does not permit outbound WebSocket access from the Paperclip server.

Core fields:
- url (string, required): OpenClaw gateway WebSocket URL (ws:// or wss://)
- headers (object, optional): handshake headers; supports x-openclaw-token / x-openclaw-auth
- authToken (string, optional): shared gateway token override
- password (string, optional): gateway shared password, if configured
- nativeAgentId (string, optional): explicit native OpenClaw agent id to target; preferred alias for agentId in Phase 1
- openclawAgentId (string, optional): compatibility alias for nativeAgentId
- agentId (string, optional): legacy gateway target agent id field; still supported

Gateway connect identity fields:
- clientId (string, optional): gateway client id (default gateway-client)
- clientMode (string, optional): gateway client mode (default backend)
- clientVersion (string, optional): client version string
- role (string, optional): gateway role (default operator)
- scopes (string[] | comma string, optional): gateway scopes (default ["operator.admin"])
- disableDeviceAuth (boolean, optional): disable signed device payload in connect params (default false)

Request behavior fields:
- payloadTemplate (object, optional): additional fields merged into gateway agent params
- workspaceRuntime (object, optional): desired runtime service intents; Paperclip forwards these in a standardized paperclip.workspaceRuntime block for remote execution environments
- timeoutSec (number, optional): adapter timeout in seconds (default 120)
- waitTimeoutMs (number, optional): agent.wait timeout override (default timeoutSec * 1000)
- autoPairOnFirstConnect (boolean, optional): on first "pairing required", attempt device.pair.list/device.pair.approve via shared auth, then retry once (default true)
- paperclipApiUrl (string, optional): absolute Paperclip base URL advertised in wake text; OpenClaw-side runs should prefer an already-set PAPERCLIP_API_URL and use this as the documented fallback/default
- paperclipClaimedApiKeyPath (string, optional): claimed-key JSON path advertised in wake text when PAPERCLIP_API_KEY is not already set; preferred to point at the mapped OpenClaw agent workspace (for example <agent-workspace>/.paperclip/claimed-api-key.json). When omitted, the adapter first tries that agent-workspace .paperclip path from the OpenClaw run context and only then falls back to the legacy ~/.openclaw/workspace/paperclip-claimed-api-key.json compatibility path

Session routing fields:
- sessionBindingMode (string, optional): main_session, dedicated_fixed, or issue_scoped. Preferred Phase 1 alias that maps onto session key behavior for one native OpenClaw-linked agent.
- sessionKeyStrategy (string, optional): legacy session routing field — issue (default), fixed, or run
- sessionKey (string, optional): fixed session key override. When omitted, sessionBindingMode derives a deterministic key.

Standard outbound payload additions:
- paperclip (object): standardized Paperclip context added to every gateway agent request
- paperclip.workspace (object, optional): resolved execution workspace for this run
- paperclip.workspaces (array, optional): additional workspace hints Paperclip exposed to the run
- paperclip.workspaceRuntime (object, optional): normalized runtime service intent config for the workspace

Standard result metadata supported:
- meta.runtimeServices (array, optional): normalized adapter-managed runtime service reports
- meta.previewUrl (string, optional): shorthand single preview URL
- meta.previewUrls (string[], optional): shorthand multiple preview URLs
`;
