import fs from "node:fs/promises";
import path from "node:path";
import type {
  AdapterSkillContext,
  AdapterSkillEntry,
  AdapterSkillSnapshot,
} from "@paperclipai/adapter-utils";
import {
  readPaperclipSkillSyncPreference,
} from "@paperclipai/adapter-utils/server-utils";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveAgentWorkspaceRoot(config: Record<string, unknown>): string | null {
  return (
    asNonEmptyString(config.openclawWorkspaceRoot)
    ?? asNonEmptyString(config.openclawAgentWorkspace)
    ?? asNonEmptyString(config.workspaceRoot)
    ?? asNonEmptyString(config.workspace)
    ?? asNonEmptyString(config.cwd)
  );
}

function resolveGlobalSkillsRoot() {
  return path.resolve(process.env.HOME ?? "~", ".openclaw", "skills");
}

async function listSkillDirs(root: string): Promise<Array<{ name: string; fullPath: string }>> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, fullPath: path.join(root, entry.name) }));
}

function normalizeRuntimeNameFromKey(key: string) {
  return key.split("/").pop() ?? key;
}

export async function listOpenClawGatewaySkills(ctx: AdapterSkillContext): Promise<AdapterSkillSnapshot> {
  const config = asRecord(ctx.config) ?? {};
  const workspaceRoot = resolveAgentWorkspaceRoot(config);
  const localSkillsRoot = workspaceRoot ? path.join(workspaceRoot, "skills") : null;
  const globalSkillsRoot = resolveGlobalSkillsRoot();
  const desiredSkills = readPaperclipSkillSyncPreference(config).desiredSkills;
  const desiredSet = new Set(desiredSkills);
  const runtimeEntriesRaw = Array.isArray(config.paperclipRuntimeSkills) ? config.paperclipRuntimeSkills : [];
  const runtimeEntries = runtimeEntriesRaw
    .map((raw) => asRecord(raw))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      key: asNonEmptyString(entry.key) ?? "",
      runtimeName: asNonEmptyString(entry.runtimeName) ?? asNonEmptyString(entry.name) ?? "",
      source: asNonEmptyString(entry.source) ?? "",
      required: Boolean(entry.required),
      requiredReason: asNonEmptyString(entry.requiredReason),
    }))
    .filter((entry) => entry.key && entry.runtimeName);

  const localDirs = localSkillsRoot ? await listSkillDirs(localSkillsRoot) : [];
  const globalDirs = await listSkillDirs(globalSkillsRoot);
  const localBySlug = new Map(localDirs.map((entry) => [entry.name, entry]));
  const globalBySlug = new Map(globalDirs.map((entry) => [entry.name, entry]));

  const runtimeBySlug = new Map(runtimeEntries.map((entry) => [normalizeRuntimeNameFromKey(entry.key), entry]));
  const allSlugs = new Set<string>([
    ...Array.from(runtimeBySlug.keys()),
    ...Array.from(localBySlug.keys()),
    ...Array.from(globalBySlug.keys()),
  ]);

  const entries: AdapterSkillEntry[] = Array.from(allSlugs).map((slug) => {
    const runtimeEntry = runtimeBySlug.get(slug) ?? null;
    const local = localBySlug.get(slug) ?? null;
    const global = globalBySlug.get(slug) ?? null;
    const key = runtimeEntry?.key ?? `openclaw/local/${slug}`;
    const desired = desiredSet.has(key);
    const required = Boolean(runtimeEntry?.required);

    let scope: AdapterSkillEntry["scope"] = required ? "bundled" : "global";
    let managed = false;
    let state: AdapterSkillEntry["state"] = desired ? "configured" : "available";
    let detail: string | null = null;
    let sourcePath = global?.fullPath ?? runtimeEntry?.source ?? null;
    let targetPath: string | null = localSkillsRoot ? path.join(localSkillsRoot, slug) : null;
    let origin: AdapterSkillEntry["origin"] = required ? "paperclip_required" : "company_managed";
    let originLabel = required ? "Required by Paperclip" : "Managed by Paperclip";

    if (local) {
      scope = "local";
      managed = true;
      state = desired || required ? "installed" : "stale";
      sourcePath = local.fullPath;
      targetPath = local.fullPath;
      detail = required
        ? "Required Paperclip skill is installed in the OpenClaw workspace skills directory."
        : global
          ? "Local OpenClaw workspace skill is present and overrides the global copy."
          : "Local OpenClaw workspace skill is present.";
    } else if (global) {
      scope = "global";
      managed = true;
      state = desired ? "configured" : "available";
      sourcePath = global.fullPath;
      detail = desired
        ? "Configured from the global OpenClaw skills directory."
        : "Available from the global OpenClaw skills directory.";
    } else if (required) {
      scope = "bundled";
      managed = true;
      state = desired ? "configured" : "available";
      detail = runtimeEntry?.requiredReason ?? "Bundled OpenClaw/Paperclip skill.";
    } else if (desired) {
      scope = "unknown";
      managed = true;
      state = "missing";
      detail = "Desired skill is not present in the native OpenClaw local or global skills roots.";
    } else if (!runtimeEntry) {
      scope = local ? "local" : global ? "global" : "unknown";
      managed = false;
      state = local || global ? "external" : "missing";
      origin = "user_installed";
      originLabel = local
        ? "Present in workspace skills"
        : global
          ? "Present in global OpenClaw skills"
          : "External or unavailable";
      detail = local
        ? "Detected from the native OpenClaw workspace skills directory."
        : global
          ? "Detected from the native OpenClaw global skills directory."
          : "Skill could not be resolved.";
    }

    return {
      key,
      runtimeName: runtimeEntry?.runtimeName ?? slug,
      desired,
      managed,
      required,
      requiredReason: runtimeEntry?.requiredReason ?? null,
      state,
      origin,
      scope,
      originLabel,
      locationLabel:
        scope === "local"
          ? (localSkillsRoot ? `${localSkillsRoot}` : "workspace skills")
          : scope === "global"
            ? globalSkillsRoot
            : scope === "bundled"
              ? "Bundled"
              : null,
      readOnly: false,
      sourcePath,
      targetPath,
      detail,
    };
  });

  for (const desiredSkill of desiredSkills) {
    if (entries.some((entry) => entry.key === desiredSkill)) continue;
    entries.push({
      key: desiredSkill,
      runtimeName: normalizeRuntimeNameFromKey(desiredSkill),
      desired: true,
      managed: true,
      required: false,
      requiredReason: null,
      state: "missing",
      origin: "external_unknown",
      scope: "unknown",
      originLabel: "Desired but unresolved",
      locationLabel: localSkillsRoot,
      readOnly: false,
      sourcePath: null,
      targetPath: localSkillsRoot ? path.join(localSkillsRoot, normalizeRuntimeNameFromKey(desiredSkill)) : null,
      detail: "Desired skill is not currently present in the native OpenClaw local or global skills roots.",
    });
  }

  entries.sort((left, right) => left.key.localeCompare(right.key));

  const warnings: string[] = [];
  if (!workspaceRoot) {
    warnings.push("OpenClaw workspace root is not configured on this agent, so local skill detection is limited.");
  }

  return {
    adapterType: "openclaw_gateway",
    supported: true,
    mode: "persistent",
    desiredSkills,
    entries,
    warnings,
  };
}

export async function syncOpenClawGatewaySkills(
  ctx: AdapterSkillContext,
  _desiredSkills: string[],
): Promise<AdapterSkillSnapshot> {
  return listOpenClawGatewaySkills(ctx);
}
