export type AgentSkillSyncMode = "unsupported" | "persistent" | "ephemeral";

export type AgentSkillState =
  | "available"
  | "configured"
  | "installed"
  | "missing"
  | "stale"
  | "external";

export type AgentSkillOrigin =
  | "company_managed"
  | "paperclip_required"
  | "user_installed"
  | "external_unknown";

export type AgentSkillScope = "bundled" | "global" | "local" | "extra_dir" | "unknown";

export type AgentSkillEffectiveState =
  | "absent"
  | "bundled_only"
  | "global_only"
  | "local_only"
  | "local_overrides_global"
  | "assigned_bundled"
  | "assigned_global"
  | "assigned_local"
  | "broken"
  | "unmanaged";

export interface AgentSkillEntry {
  key: string;
  runtimeName: string | null;
  desired: boolean;
  managed: boolean;
  required?: boolean;
  requiredReason?: string | null;
  state: AgentSkillState;
  origin?: AgentSkillOrigin;
  scope?: AgentSkillScope;
  effectiveState?: AgentSkillEffectiveState;
  originLabel?: string | null;
  locationLabel?: string | null;
  readOnly?: boolean;
  sourcePath?: string | null;
  targetPath?: string | null;
  detail?: string | null;
}

export interface AgentSkillSnapshot {
  adapterType: string;
  supported: boolean;
  mode: AgentSkillSyncMode;
  desiredSkills: string[];
  entries: AgentSkillEntry[];
  warnings: string[];
}

export interface AgentSkillSyncRequest {
  desiredSkills: string[];
}
