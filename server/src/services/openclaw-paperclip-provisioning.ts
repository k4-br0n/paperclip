import fs from "node:fs/promises";
import path from "node:path";
import type { Db } from "@paperclipai/db";
import { normalizeAgentUrlKey } from "@paperclipai/shared";
import type { agentService } from "./agents.js";
import type { agentInstructionsService } from "./agent-instructions.js";
import { badRequest, conflict, notFound } from "../errors.js";

const DEFAULT_RELATIVE_KEY_PATH = ".paperclip/claimed-api-key.json";
const AGENTS_NOTE_HEADER = "## Paperclip Integration";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveAgentWorkspaceRoot(adapterConfig: Record<string, unknown>): string | null {
  return (
    asNonEmptyString(adapterConfig.openclawWorkspaceRoot)
    ?? asNonEmptyString(adapterConfig.openclawAgentWorkspace)
    ?? asNonEmptyString(adapterConfig.workspaceRoot)
    ?? asNonEmptyString(adapterConfig.workspace)
    ?? asNonEmptyString(adapterConfig.cwd)
  );
}

function buildKeyPayload(input: { token: string; keyId: string; agentId: string; apiUrl: string; keyName: string }) {
  return {
    token: input.token,
    keyId: input.keyId,
    keyName: input.keyName,
    agentId: input.agentId,
    apiUrl: input.apiUrl,
    createdAt: new Date().toISOString(),
  };
}

async function assertWorkspaceRootExists(workspaceRoot: string) {
  const stats = await fs.stat(workspaceRoot).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    throw conflict(`Configured OpenClaw workspace root does not exist or is not a directory: ${workspaceRoot}`);
  }
}

async function nextProvisionedKeyName(input: {
  agents: ReturnType<typeof agentService>;
  agentId: string;
  agentName: string;
}) {
  const existing = await input.agents.listKeys(input.agentId);
  const slug = normalizeAgentUrlKey(input.agentName) ?? "agent";
  const prefix = `${slug}-openclaw-`;
  let maxSeen = 0;
  for (const key of existing) {
    const match = key.name.match(new RegExp(`^${prefix}(\\d+)$`));
    if (!match) continue;
    const parsed = Number.parseInt(match[1] ?? "0", 10);
    if (Number.isFinite(parsed) && parsed > maxSeen) maxSeen = parsed;
  }
  return `${prefix}${maxSeen + 1}`;
}

function buildAgentsMdNote(input: { claimedApiKeyPath: string; apiUrl: string; paperclipAgentName: string }) {
  return [
    AGENTS_NOTE_HEADER,
    "",
    `- This agent is linked to Paperclip agent **${input.paperclipAgentName}**.`,
    `- Paperclip claimed API key file: \`${input.claimedApiKeyPath}\``,
    `- Paperclip API base URL: \`${input.apiUrl}\``,
    "- For Paperclip-issued work, load the token from that JSON file into `PAPERCLIP_API_KEY` and use `PAPERCLIP_API_URL` from the same record or this note.",
    "- Keep this file private. Do not paste the token into chat or commit it.",
    "",
  ].join("\n");
}

async function upsertAgentsMdNote(input: {
  instructions: ReturnType<typeof agentInstructionsService>;
  agent: Awaited<ReturnType<ReturnType<typeof agentService>["getById"]>>;
  claimedApiKeyPath: string;
  apiUrl: string;
}) {
  if (!input.agent) return;
  const bundle = await input.instructions.ensureManagedBundle(input.agent);
  const file = await input.instructions.readFile(input.agent, "AGENTS.md").catch(() => ({ content: "", path: "AGENTS.md", isEntryFile: true }));
  const current = file.content ?? "";
  const note = buildAgentsMdNote({
    claimedApiKeyPath: input.claimedApiKeyPath,
    apiUrl: input.apiUrl,
    paperclipAgentName: input.agent.name,
  });
  const next = current.includes(AGENTS_NOTE_HEADER)
    ? current.replace(new RegExp(`${AGENTS_NOTE_HEADER}[\\s\\S]*?$`, "m"), note.trimEnd())
    : `${current.trimEnd()}\n\n${note}`.trimStart();
  await input.instructions.writeFile(input.agent, "AGENTS.md", next, { clearLegacyPromptTemplate: false });
  return bundle;
}

export function openClawPaperclipProvisioningService(input: {
  db: Db;
  agents: ReturnType<typeof agentService>;
  instructions: ReturnType<typeof agentInstructionsService>;
  paperclipBaseUrl: string;
}) {
  return {
    async provisionForAgent(agentId: string) {
      const agent = await input.agents.getById(agentId);
      if (!agent) throw notFound("Agent not found");
      if (agent.adapterType !== "openclaw_gateway") {
        throw badRequest("Provisioning is only supported for openclaw_gateway agents");
      }

      const adapterConfig = asRecord(agent.adapterConfig) ?? {};
      const workspaceRoot = resolveAgentWorkspaceRoot(adapterConfig);
      if (!workspaceRoot) {
        throw conflict("Agent adapter config is missing an OpenClaw workspace root/cwd to store the Paperclip key");
      }

      await assertWorkspaceRootExists(workspaceRoot);

      const claimedApiKeyPath =
        asNonEmptyString(adapterConfig.paperclipClaimedApiKeyPath)
        ?? path.join(workspaceRoot, DEFAULT_RELATIVE_KEY_PATH);

      await fs.mkdir(path.dirname(claimedApiKeyPath), { recursive: true });

      const keyName = await nextProvisionedKeyName({
        agents: input.agents,
        agentId: agent.id,
        agentName: agent.name,
      });
      const created = await input.agents.createApiKey(agent.id, keyName);
      const payload = buildKeyPayload({
        token: created.token,
        keyId: created.id,
        keyName: created.name,
        agentId: agent.id,
        apiUrl: input.paperclipBaseUrl,
      });
      await fs.writeFile(claimedApiKeyPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await fs.chmod(claimedApiKeyPath, 0o600).catch(() => undefined);

      const nextAdapterConfig: Record<string, unknown> = {
        ...adapterConfig,
        paperclipApiUrl: asNonEmptyString(adapterConfig.paperclipApiUrl) ?? input.paperclipBaseUrl,
        paperclipClaimedApiKeyPath: claimedApiKeyPath,
      };
      delete nextAdapterConfig.paperclipUseLegacyGlobalClaimedKeyFallback;

      await input.agents.update(agent.id, { adapterConfig: nextAdapterConfig }, {
        recordRevision: {
          source: "openclaw-paperclip-provision",
        },
      });

      const refreshed = await input.agents.getById(agent.id);
      if (refreshed) {
        await upsertAgentsMdNote({
          instructions: input.instructions,
          agent: refreshed,
          claimedApiKeyPath,
          apiUrl: input.paperclipBaseUrl,
        });
      }

      return {
        agentId: agent.id,
        claimedApiKeyPath,
        apiUrl: input.paperclipBaseUrl,
        keyId: created.id,
        keyName: created.name,
      };
    },

    async testIdentityForAgent(agentId: string) {
      const agent = await input.agents.getById(agentId);
      if (!agent) throw notFound("Agent not found");

      const adapterConfig = asRecord(agent.adapterConfig) ?? {};
      const workspaceRoot = resolveAgentWorkspaceRoot(adapterConfig);
      if (!workspaceRoot) {
        throw conflict("Agent adapter config is missing an OpenClaw workspace root/cwd to inspect the Paperclip key");
      }
      await assertWorkspaceRootExists(workspaceRoot);

      const claimedApiKeyPath =
        asNonEmptyString(adapterConfig.paperclipClaimedApiKeyPath)
        ?? path.join(workspaceRoot, DEFAULT_RELATIVE_KEY_PATH);
      const raw = await fs.readFile(claimedApiKeyPath, "utf8").catch(() => null);
      if (!raw) {
        throw notFound(`No Paperclip claimed key file found at ${claimedApiKeyPath}`);
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const token = asNonEmptyString(parsed.token);
      if (!token) {
        throw conflict(`Claimed key file at ${claimedApiKeyPath} is missing a token field`);
      }

      const response = await fetch(`${input.paperclipBaseUrl}/agents/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const message = (body && typeof body === "object" && body && "error" in body && typeof body.error === "string")
          ? body.error
          : `Paperclip identity check failed: ${response.status}`;
        throw conflict(message);
      }

      const bodyRecord = asRecord(body) ?? {};
      return {
        claimedApiKeyPath,
        resolvedAgentId: asNonEmptyString(bodyRecord.id) ?? "unknown",
        resolvedAgentName: asNonEmptyString(bodyRecord.name) ?? "unknown",
        keyName: asNonEmptyString(parsed.keyName) ?? null,
      };
    },
  };
}
