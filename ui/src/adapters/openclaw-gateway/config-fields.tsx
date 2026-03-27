import { useState } from "react";
import { ApiError } from "../../api/client";
import { Copy, Eye, EyeOff, FolderOpen } from "lucide-react";
import { Button } from "../../components/ui/button";
import { agentsApi } from "../../api/agents";
import { useToast } from "../../context/ToastContext";
import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
  help,
} from "../../components/agent-config-primitives";
import {
  PayloadTemplateJsonField,
  RuntimeServicesJsonField,
} from "../runtime-json-fields";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function SecretField({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <DraftInput
          value={value}
          onCommit={onCommit}
          immediate
          type={visible ? "text" : "password"}
          className={inputClass + " pl-8"}
          placeholder={placeholder}
        />
      </div>
    </Field>
  );
}

function parseScopes(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string").join(", ");
  }
  return typeof value === "string" ? value : "";
}

export function OpenClawGatewayConfigFields({
  isCreate,
  agentId,
  companyId,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  const configuredHeaders =
    config.headers && typeof config.headers === "object" && !Array.isArray(config.headers)
      ? (config.headers as Record<string, unknown>)
      : {};
  const effectiveHeaders =
    (eff("adapterConfig", "headers", configuredHeaders) as Record<string, unknown>) ?? {};

  const effectiveGatewayToken = typeof effectiveHeaders["x-openclaw-token"] === "string"
    ? String(effectiveHeaders["x-openclaw-token"])
    : typeof effectiveHeaders["x-openclaw-auth"] === "string"
      ? String(effectiveHeaders["x-openclaw-auth"])
      : "";

  const commitGatewayToken = (rawValue: string) => {
    const nextValue = rawValue.trim();
    const nextHeaders: Record<string, unknown> = { ...effectiveHeaders };
    if (nextValue) {
      nextHeaders["x-openclaw-token"] = nextValue;
      delete nextHeaders["x-openclaw-auth"];
    } else {
      delete nextHeaders["x-openclaw-token"];
      delete nextHeaders["x-openclaw-auth"];
    }
    mark("adapterConfig", "headers", Object.keys(nextHeaders).length > 0 ? nextHeaders : undefined);
  };

  const { pushToast } = useToast();
  const [provisionState, setProvisionState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [provisionMessage, setProvisionMessage] = useState<string>("");
  const [identityTestState, setIdentityTestState] = useState<"idle" | "running" | "success" | "error">("idle");

  const effectiveWorkspaceRoot = isCreate
    ? String(values?.openclawWorkspaceRoot ?? "")
    : eff(
        "adapterConfig",
        "openclawWorkspaceRoot",
        String(config.openclawWorkspaceRoot ?? config.openclawAgentWorkspace ?? config.workspaceRoot ?? config.workspace ?? config.cwd ?? ""),
      );
  const effectiveClaimedApiKeyPath = eff(
    "adapterConfig",
    "paperclipClaimedApiKeyPath",
    String(config.paperclipClaimedApiKeyPath ?? ""),
  );
  const resolvedProvisionTargetPath = (effectiveClaimedApiKeyPath || (effectiveWorkspaceRoot ? `${effectiveWorkspaceRoot.replace(/\/$/, "")}/.paperclip/claimed-api-key.json` : "")).trim();
  const effectivePaperclipApiUrl = eff(
    "adapterConfig",
    "paperclipApiUrl",
    String(config.paperclipApiUrl ?? ""),
  );

  const sessionBindingMode = eff(
    "adapterConfig",
    "sessionBindingMode",
    String(config.sessionBindingMode ?? "issue_scoped"),
  );
  const sessionStrategy = eff(
    "adapterConfig",
    "sessionKeyStrategy",
    String(config.sessionKeyStrategy ?? "fixed"),
  );

  return (
    <>
      <Field label="Gateway URL" hint={help.webhookUrl}>
        <DraftInput
          value={
            isCreate
              ? values!.url
              : eff("adapterConfig", "url", String(config.url ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ url: v })
              : mark("adapterConfig", "url", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="ws://127.0.0.1:18789"
        />
      </Field>

      <PayloadTemplateJsonField
        isCreate={isCreate}
        values={values}
        set={set}
        config={config}
        mark={mark}
      />

      <RuntimeServicesJsonField
        isCreate={isCreate}
        values={values}
        set={set}
        config={config}
        mark={mark}
      />

      <Field label="OpenClaw agent workspace root">
        <div className="space-y-2">
          {isCreate ? (
            <div className="rounded-md border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
              Set this during agent creation if you want Paperclip required skills to be provisioned into the native OpenClaw <span className="font-mono">skills/</span> path later. Without it, provisioning can only be partial.
            </div>
          ) : null}
          <DraftInput
            value={effectiveWorkspaceRoot}
            onCommit={(v) => {
              const next = v || undefined;
              if (isCreate) {
                set?.({ openclawWorkspaceRoot: next ?? "" });
              } else {
                mark("adapterConfig", "openclawWorkspaceRoot", next);
              }
            }}
            immediate
            className={inputClass}
            placeholder="/home/jorge/.openclaw/workspace-phronesis"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={async () => {
                if (!effectiveWorkspaceRoot) return;
                await navigator.clipboard.writeText(effectiveWorkspaceRoot);
                pushToast({
                  title: "Workspace path copied",
                  body: effectiveWorkspaceRoot,
                  tone: "success",
                  ttlMs: 2500,
                });
              }}
              disabled={!effectiveWorkspaceRoot}
            >
              <Copy className="h-3 w-3" /> Copy path
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => {
                if (!effectiveWorkspaceRoot) return;
                window.open(`file://${effectiveWorkspaceRoot}`, "_blank", "noopener,noreferrer");
              }}
              disabled={!effectiveWorkspaceRoot}
            >
              <FolderOpen className="h-3 w-3" /> Open path
            </Button>
          </div>
        </div>
      </Field>

      {!isCreate && (
        <>
          <Field label="Paperclip API URL override">
            <DraftInput
              value={
                eff(
                  "adapterConfig",
                  "paperclipApiUrl",
                  String(config.paperclipApiUrl ?? ""),
                )
              }
              onCommit={(v) => mark("adapterConfig", "paperclipApiUrl", v || undefined)}
              immediate
              className={inputClass}
              placeholder="https://paperclip.example"
            />
          </Field>

          <Field label="Bound native OpenClaw agent id">
            <DraftInput
              value={
                eff(
                  "adapterConfig",
                  "nativeAgentId",
                  String(config.nativeAgentId ?? config.agentId ?? ""),
                )
              }
              onCommit={(v) => {
                const next = v || undefined;
                mark("adapterConfig", "nativeAgentId", next);
                if (next) {
                  mark("adapterConfig", "agentId", undefined);
                  mark("adapterConfig", "openclawAgentId", undefined);
                }
              }}
              immediate
              className={inputClass}
              placeholder="native OpenClaw agent id"
            />
          </Field>

          <Field label="Session binding mode">
            <select
              value={sessionBindingMode}
              onChange={(e) => mark("adapterConfig", "sessionBindingMode", e.target.value)}
              className={inputClass}
            >
              <option value="issue_scoped">Issue scoped</option>
              <option value="main_session">Main session</option>
              <option value="dedicated_fixed">Dedicated fixed session</option>
            </select>
          </Field>

          <Field label="Legacy session strategy">
            <select
              value={sessionStrategy}
              onChange={(e) => mark("adapterConfig", "sessionKeyStrategy", e.target.value)}
              className={inputClass}
            >
              <option value="fixed">Fixed</option>
              <option value="issue">Per issue</option>
              <option value="run">Per run</option>
            </select>
          </Field>

          {(sessionBindingMode === "main_session" ||
            sessionBindingMode === "dedicated_fixed" ||
            sessionStrategy === "fixed") && (
            <Field label="Session key override">
              <DraftInput
                value={eff("adapterConfig", "sessionKey", String(config.sessionKey ?? ""))}
                onCommit={(v) => mark("adapterConfig", "sessionKey", v || undefined)}
                immediate
                className={inputClass}
                placeholder={
                  sessionBindingMode === "main_session"
                    ? "Defaults to agent:<id>:paperclip:main"
                    : sessionBindingMode === "dedicated_fixed"
                      ? "Defaults to agent:<id>:paperclip:dedicated"
                      : "paperclip"
                }
              />
            </Field>
          )}

          <Field label="Paperclip claimed API key path">
            <div className="space-y-2">
              <DraftInput
                value={effectiveClaimedApiKeyPath}
                onCommit={(v) => mark("adapterConfig", "paperclipClaimedApiKeyPath", v || undefined)}
                immediate
                className={inputClass}
                placeholder="Defaults to <agent-workspace>/.paperclip/claimed-api-key.json"
              />
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">Resolved target path</div>
                <div className="mt-1 break-all font-mono">
                  {resolvedProvisionTargetPath || "Set an OpenClaw agent workspace root or explicit claimed key path."}
                </div>
              </div>
            </div>
          </Field>

          {!isCreate && agentId && (
            <Field label="Provision Paperclip API key">
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-3 text-xs"
                  disabled={provisionState === "running" || !effectiveWorkspaceRoot || !eff("adapterConfig", "nativeAgentId", String(config.nativeAgentId ?? config.agentId ?? ""))}
                  onClick={async () => {
                    const effectiveNativeAgentId = eff("adapterConfig", "nativeAgentId", String(config.nativeAgentId ?? config.agentId ?? ""));
                    if (!effectiveWorkspaceRoot) {
                      const message = "Set the OpenClaw agent workspace root before provisioning Paperclip access and required skills.";
                      setProvisionState("error");
                      setProvisionMessage(message);
                      pushToast({
                        dedupeKey: `openclaw-provision-missing-workspace:${agentId}`,
                        title: "Workspace path required",
                        body: message,
                        tone: "error",
                        ttlMs: 25000,
                      });
                      return;
                    }
                    if (!effectiveNativeAgentId.trim()) {
                      const message = "Set the bound native OpenClaw agent id before provisioning so Paperclip can bind the correct session and workspace behavior.";
                      setProvisionState("error");
                      setProvisionMessage(message);
                      pushToast({
                        dedupeKey: `openclaw-provision-missing-workspace:${agentId}`,
                        title: "Workspace path required",
                        body: message,
                        tone: "error",
                        ttlMs: 25000,
                      });
                      return;
                    }
                    setProvisionState("running");
                    setProvisionMessage("Provisioning Paperclip access and required skills...");
                    pushToast({
                      dedupeKey: `openclaw-provision-start:${agentId}`,
                      title: "Provisioning Paperclip access",
                      body: "Creating an agent-scoped key and installing required Paperclip skills into the mapped OpenClaw workspace.",
                      tone: "info",
                      ttlMs: 7000,
                    });
                    try {
                      const result = await agentsApi.provisionOpenClawPaperclipKey(agentId, companyId);
                      mark("adapterConfig", "paperclipClaimedApiKeyPath", result.claimedApiKeyPath);
                      const existingPaperclipApiUrl = eff(
                        "adapterConfig",
                        "paperclipApiUrl",
                        String(config.paperclipApiUrl ?? ""),
                      ).trim();
                      if (!existingPaperclipApiUrl) {
                        mark("adapterConfig", "paperclipApiUrl", result.apiUrl);
                      }
                      setProvisionState("success");
                      setProvisionMessage(`Provisioned ${result.keyName} at ${result.claimedApiKeyPath}`);
                      pushToast({
                        dedupeKey: `openclaw-provision-success:${agentId}:${result.keyName}`,
                        title: "Paperclip access provisioned",
                        body: result.installedRequiredSkillPaths?.length
                          ? `${result.keyName} saved to ${result.claimedApiKeyPath}. Installed ${result.installedRequiredSkillPaths.length} required skill${result.installedRequiredSkillPaths.length === 1 ? "" : "s"}.`
                          : `${result.keyName} saved to ${result.claimedApiKeyPath}`,
                        tone: "success",
                        ttlMs: 25000,
                      });
                    } catch (error) {
                      const message = error instanceof ApiError
                        ? error.message
                        : error instanceof Error
                          ? error.message
                          : "Provisioning failed";
                      setProvisionState("error");
                      setProvisionMessage(message);
                      pushToast({
                        dedupeKey: `openclaw-provision-error:${agentId}:${message}`,
                        title: "Paperclip key provisioning failed",
                        body: message,
                        tone: "error",
                        ttlMs: 10000,
                      });
                    }
                  }}
                >
                  {provisionState === "running" ? "Provisioning..." : "Provision Paperclip access + required skills"}
                </Button>
                {provisionMessage ? (
                  <div className={provisionState === "error" ? "text-xs text-red-400" : provisionState === "success" ? "text-xs text-green-400" : "text-xs text-muted-foreground"}>
                    {provisionMessage}
                  </div>
                ) : null}
                <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
                  <div><span className="font-medium text-foreground">Current Paperclip API URL:</span> <span className="font-mono break-all">{effectivePaperclipApiUrl || "(not set)"}</span></div>
                  <div><span className="font-medium text-foreground">Workspace root:</span> <span className="font-mono break-all">{effectiveWorkspaceRoot || "(required for provisioning required local skills)"}</span></div>
                  <div><span className="font-medium text-foreground">Bound native OpenClaw agent id:</span> <span className="font-mono break-all">{eff("adapterConfig", "nativeAgentId", String(config.nativeAgentId ?? config.agentId ?? "")) || "(required before provisioning)"}</span></div>
                  <div><span className="font-medium text-foreground">Last provisioned key:</span> <span className="font-mono">{provisionState === "success" ? provisionMessage.replace(/^Provisioned\s+/, "").split(" at ")[0] : "Run provisioning after setting workspace root + native agent id"}</span></div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={identityTestState === "running"}
                    onClick={async () => {
                      setIdentityTestState("running");
                      pushToast({
                        dedupeKey: `openclaw-identity-start:${agentId}`,
                        title: "Testing Paperclip identity",
                        body: "Checking which Paperclip agent the stored claimed key resolves to.",
                        tone: "info",
                        ttlMs: 2500,
                      });
                      try {
                        const result = await agentsApi.testOpenClawPaperclipIdentity(agentId, companyId);
                        setIdentityTestState("success");
                        pushToast({
                          dedupeKey: `openclaw-identity-success:${agentId}:${result.resolvedAgentId}`,
                          title: "Paperclip identity resolved",
                          body: `${result.resolvedAgentName} (${result.resolvedAgentId}) via ${result.keyName ?? "stored claimed key"}`,
                          tone: "success",
                          ttlMs: 7000,
                        });
                      } catch (error) {
                        const message = error instanceof ApiError
                          ? error.message
                          : error instanceof Error
                            ? error.message
                            : "Identity test failed";
                        setIdentityTestState("error");
                        pushToast({
                          dedupeKey: `openclaw-identity-error:${agentId}:${message}`,
                          title: "Paperclip identity test failed",
                          body: message,
                          tone: "error",
                          ttlMs: 10000,
                        });
                      }
                    }}
                  >
                    {identityTestState === "running" ? "Testing identity..." : "Test Paperclip identity"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Once your workspace root and native OpenClaw agent id are set, this provisions Paperclip access for the agent,
                  installs required Paperclip skills into the local <span className="font-mono">skills/</span> directory,
                  updates the claimed key path, and appends Paperclip access notes to AGENTS.md.
                </p>
                {!effectiveWorkspaceRoot || !eff("adapterConfig", "nativeAgentId", String(config.nativeAgentId ?? config.agentId ?? "")) ? (
                  <div className="rounded-md border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
                    {effectiveWorkspaceRoot
                      ? "Your workspace root is set. Next, fill in the bound native OpenClaw agent id, then provision Paperclip access and required local skills below."
                      : "Set the OpenClaw workspace root first. Then fill in the bound native OpenClaw agent id and provision Paperclip access plus required local skills below."}
                  </div>
                ) : (
                  <div className="rounded-md border border-emerald-300/60 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:text-emerald-200">
                    Your workspace root and native OpenClaw agent id are set. You can now provision Paperclip access and required local skills below.
                  </div>
                )}
              </div>
            </Field>
          )}

          <SecretField
            label="Gateway auth token (x-openclaw-token)"
            value={effectiveGatewayToken}
            onCommit={commitGatewayToken}
            placeholder="OpenClaw gateway token"
          />

          <Field label="Role">
            <DraftInput
              value={eff("adapterConfig", "role", String(config.role ?? "operator"))}
              onCommit={(v) => mark("adapterConfig", "role", v || undefined)}
              immediate
              className={inputClass}
              placeholder="operator"
            />
          </Field>

          <Field label="Scopes (comma-separated)">
            <DraftInput
              value={eff("adapterConfig", "scopes", parseScopes(config.scopes ?? ["operator.admin"]))}
              onCommit={(v) => {
                const parsed = v
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean);
                mark("adapterConfig", "scopes", parsed.length > 0 ? parsed : undefined);
              }}
              immediate
              className={inputClass}
              placeholder="operator.admin"
            />
          </Field>

          <Field label="Wait timeout (ms)">
            <DraftInput
              value={eff("adapterConfig", "waitTimeoutMs", String(config.waitTimeoutMs ?? "120000"))}
              onCommit={(v) => {
                const parsed = Number.parseInt(v.trim(), 10);
                mark(
                  "adapterConfig",
                  "waitTimeoutMs",
                  Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                );
              }}
              immediate
              className={inputClass}
              placeholder="120000"
            />
          </Field>

          <Field label="Device auth">
            <div className="text-xs text-muted-foreground leading-relaxed">
              Always enabled for gateway agents. Paperclip persists a device key during onboarding so pairing approvals
              remain stable across runs.
            </div>
          </Field>
        </>
      )}
    </>
  );
}
