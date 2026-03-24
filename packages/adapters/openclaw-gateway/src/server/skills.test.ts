import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { listOpenClawGatewaySkills } from "./skills.js";

const cleanupDirs = new Set<string>();

afterEach(async () => {
  await Promise.all(Array.from(cleanupDirs, (dir) => fs.rm(dir, { recursive: true, force: true })));
  cleanupDirs.clear();
});

async function makeTempDir(prefix: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  cleanupDirs.add(dir);
  return dir;
}

async function writeSkillDir(skillDir: string, name: string) {
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n\n# ${name}\n`, "utf8");
}

describe("openclaw gateway skill snapshot", () => {
  it("falls back to bundled required skills when no local or global copy exists", async () => {
    const workspace = await makeTempDir("paperclip-openclaw-workspace-");

    const snapshot = await listOpenClawGatewaySkills({
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "openclaw_gateway",
      config: {
        openclawWorkspaceRoot: workspace,
        paperclipSkillSync: { desiredSkills: ["paperclipai/paperclip/paperclip"] },
        paperclipRuntimeSkills: [
          {
            key: "paperclipai/paperclip/paperclip",
            runtimeName: "paperclip",
            source: "/tmp/bundled/paperclip",
            required: true,
            requiredReason: "Bundled Paperclip skill",
          },
        ],
      },
    });

    const entry = snapshot.entries.find((item) => item.key === "paperclipai/paperclip/paperclip");
    expect(entry).toMatchObject({
      scope: "bundled",
      state: "configured",
      required: true,
      detail: "Bundled Paperclip skill",
    });
  });

  it("treats required Paperclip skills copied into the workspace as required local installs", async () => {
    const workspace = await makeTempDir("paperclip-openclaw-workspace-");
    const localRoot = path.join(workspace, "skills");
    await writeSkillDir(path.join(localRoot, "paperclip"), "Paperclip");

    const snapshot = await listOpenClawGatewaySkills({
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "openclaw_gateway",
      config: {
        openclawWorkspaceRoot: workspace,
        paperclipRuntimeSkills: [
          {
            key: "paperclipai/paperclip/paperclip",
            runtimeName: "paperclip",
            source: "/tmp/bundled/paperclip",
            required: true,
            requiredReason: "Bundled Paperclip skill",
          },
        ],
      },
    });

    const entry = snapshot.entries.find((item) => item.key === "paperclipai/paperclip/paperclip");
    expect(entry).toMatchObject({
      scope: "local",
      state: "installed",
      required: true,
      detail: "Required Paperclip skill is installed in the OpenClaw workspace skills directory.",
    });
  });

  it("prefers local workspace skills over global skills for the same runtime slug", async () => {
    const fakeHome = await makeTempDir("paperclip-openclaw-home-");
    const workspace = await makeTempDir("paperclip-openclaw-workspace-");
    const globalRoot = path.join(fakeHome, ".openclaw", "skills");
    const localRoot = path.join(workspace, "skills");

    await writeSkillDir(path.join(globalRoot, "release"), "Release Global");
    await writeSkillDir(path.join(localRoot, "release"), "Release Local");

    const previousHome = process.env.HOME;
    process.env.HOME = fakeHome;
    try {
      const snapshot = await listOpenClawGatewaySkills({
        agentId: "agent-1",
        companyId: "company-1",
        adapterType: "openclaw_gateway",
        config: {
          openclawWorkspaceRoot: workspace,
          paperclipSkillSync: { desiredSkills: ["company/release"] },
          paperclipRuntimeSkills: [
            {
              key: "company/release",
              runtimeName: "release",
              source: path.join(globalRoot, "release"),
            },
          ],
        },
      });

      const entry = snapshot.entries.find((item) => item.key === "company/release");
      expect(entry).toMatchObject({
        scope: "local",
        state: "installed",
        sourcePath: path.join(localRoot, "release"),
        targetPath: path.join(localRoot, "release"),
      });
    } finally {
      process.env.HOME = previousHome;
    }
  });

  it("still reports native local/global skills even when runtime skill projection is incomplete", async () => {
    const fakeHome = await makeTempDir("paperclip-openclaw-home-");
    const workspace = await makeTempDir("paperclip-openclaw-workspace-");
    const globalRoot = path.join(fakeHome, ".openclaw", "skills");
    const localRoot = path.join(workspace, "skills");

    await writeSkillDir(path.join(globalRoot, "global-only"), "Global Only");
    await writeSkillDir(path.join(localRoot, "local-only"), "Local Only");

    const previousHome = process.env.HOME;
    process.env.HOME = fakeHome;
    try {
      const snapshot = await listOpenClawGatewaySkills({
        agentId: "agent-1",
        companyId: "company-1",
        adapterType: "openclaw_gateway",
        config: {
          openclawWorkspaceRoot: workspace,
          paperclipRuntimeSkills: [],
        },
      });

      expect(snapshot.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            runtimeName: "global-only",
            scope: "global",
            state: "external",
          }),
          expect.objectContaining({
            runtimeName: "local-only",
            scope: "local",
            state: "external",
          }),
        ]),
      );
    } finally {
      process.env.HOME = previousHome;
    }
  });
});
