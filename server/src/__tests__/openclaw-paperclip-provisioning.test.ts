import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  mkdirMock: vi.fn(async () => undefined),
  writeFileMock: vi.fn(async () => undefined),
  chmodMock: vi.fn(async () => undefined),
  statMock: vi.fn(async () => ({ isDirectory: () => true })),
  rmMock: vi.fn(async () => undefined),
  cpMock: vi.fn(async () => undefined),
  readFileMock: vi.fn(async () => ""),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: fsMocks.mkdirMock,
    writeFile: fsMocks.writeFileMock,
    chmod: fsMocks.chmodMock,
    stat: fsMocks.statMock,
    rm: fsMocks.rmMock,
    cp: fsMocks.cpMock,
    readFile: fsMocks.readFileMock,
  },
}));

import { openClawPaperclipProvisioningService } from "../services/openclaw-paperclip-provisioning.js";

describe("openClawPaperclipProvisioningService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "paperclip-agent-1", name: "Telos" }),
    })) as typeof fetch;
  });

  it("writes claimed-api-key.json using saved per-agent paperclipApiUrl override", async () => {
    const updateMock = vi.fn(async () => undefined);
    const getByIdMock = vi
      .fn()
      .mockResolvedValueOnce({
        id: "agent-1",
        companyId: "company-1",
        name: "Telos",
        adapterType: "openclaw_gateway",
        adapterConfig: {
          openclawWorkspaceRoot: "/tmp/openclaw-workspace",
          paperclipClaimedApiKeyPath: "/tmp/openclaw-workspace/.paperclip/claimed-api-key.json",
          paperclipApiUrl: "http://127.0.0.1:3110/api",
        },
      })
      .mockResolvedValueOnce({
        id: "agent-1",
        companyId: "company-1",
        name: "Telos",
        adapterType: "openclaw_gateway",
        adapterConfig: {
          openclawWorkspaceRoot: "/tmp/openclaw-workspace",
          paperclipClaimedApiKeyPath: "/tmp/openclaw-workspace/.paperclip/claimed-api-key.json",
          paperclipApiUrl: "http://127.0.0.1:3110/api",
        },
      });

    const service = openClawPaperclipProvisioningService({
      db: {} as never,
      agents: {
        getById: getByIdMock,
        listKeys: vi.fn(async () => []),
        createApiKey: vi.fn(async () => ({
          id: "key-1",
          name: "telos-openclaw-1",
          token: "pcp_test_token",
        })),
        update: updateMock,
      } as never,
      instructions: {
        ensureManagedBundle: vi.fn(async () => ({})),
        readFile: vi.fn(async () => ({ content: "", path: "AGENTS.md", isEntryFile: true })),
        writeFile: vi.fn(async () => undefined),
      } as never,
      companySkills: {
        listRuntimeSkillEntries: vi.fn(async () => []),
      } as never,
      paperclipBaseUrl: "http://127.0.0.1:3213/api",
    });

    const result = await service.provisionForAgent("agent-1");

    expect(result.apiUrl).toBe("http://127.0.0.1:3110/api");
    expect(updateMock).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({
        adapterConfig: expect.objectContaining({
          paperclipApiUrl: "http://127.0.0.1:3110/api",
        }),
      }),
      expect.anything(),
    );

    const writeCall = fsMocks.writeFileMock.mock.calls.find(([filePath]) =>
      String(filePath).includes("claimed-api-key.json"),
    );
    expect(writeCall).toBeTruthy();
    expect(String(writeCall?.[1])).toContain('"apiUrl": "http://127.0.0.1:3110/api"');
  });

  it("syncs existing claimed-api-key.json from saved per-agent config on save", async () => {
    fsMocks.readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        token: "pcp_existing_token",
        keyId: "key-existing",
        keyName: "telos-openclaw-1",
        agentId: "agent-3",
        apiUrl: "http://127.0.0.1:3213/api",
        createdAt: "2026-03-27T00:00:00.000Z",
      }),
    );

    const service = openClawPaperclipProvisioningService({
      db: {} as never,
      agents: {
        getById: vi.fn(async () => ({
          id: "agent-3",
          companyId: "company-1",
          name: "Telos",
          adapterType: "openclaw_gateway",
          adapterConfig: {
            openclawWorkspaceRoot: "/tmp/openclaw-workspace-3",
            paperclipClaimedApiKeyPath: "/tmp/openclaw-workspace-3/.paperclip/claimed-api-key.json",
            paperclipApiUrl: "http://127.0.0.1:3110/api",
          },
        })),
      } as never,
      instructions: {} as never,
      companySkills: {} as never,
      paperclipBaseUrl: "http://127.0.0.1:3213/api",
    });

    const result = await service.syncClaimedKeyForAgent("agent-3");

    expect(result).toEqual({
      claimedApiKeyPath: "/tmp/openclaw-workspace-3/.paperclip/claimed-api-key.json",
      apiUrl: "http://127.0.0.1:3110/api",
    });
    const writeCall = fsMocks.writeFileMock.mock.calls.find(([filePath]) =>
      String(filePath).includes("claimed-api-key.json"),
    );
    expect(writeCall).toBeTruthy();
    expect(String(writeCall?.[1])).toContain('"apiUrl": "http://127.0.0.1:3110/api"');
    expect(String(writeCall?.[1])).toContain('"token": "pcp_existing_token"');
    expect(String(writeCall?.[1])).toContain('"createdAt": "2026-03-27T00:00:00.000Z"');
  });

  it("falls back to server paperclip base url when no per-agent override exists", async () => {
    const service = openClawPaperclipProvisioningService({
      db: {} as never,
      agents: {
        getById: vi
          .fn()
          .mockResolvedValueOnce({
            id: "agent-2",
            companyId: "company-1",
            name: "Phronesis",
            adapterType: "openclaw_gateway",
            adapterConfig: {
              openclawWorkspaceRoot: "/tmp/openclaw-workspace-2",
            },
          })
          .mockResolvedValueOnce({
            id: "agent-2",
            companyId: "company-1",
            name: "Phronesis",
            adapterType: "openclaw_gateway",
            adapterConfig: {
              openclawWorkspaceRoot: "/tmp/openclaw-workspace-2",
              paperclipApiUrl: "http://127.0.0.1:3213/api",
            },
          }),
        listKeys: vi.fn(async () => []),
        createApiKey: vi.fn(async () => ({
          id: "key-2",
          name: "phronesis-openclaw-1",
          token: "pcp_test_token_2",
        })),
        update: vi.fn(async () => undefined),
      } as never,
      instructions: {
        ensureManagedBundle: vi.fn(async () => ({})),
        readFile: vi.fn(async () => ({ content: "", path: "AGENTS.md", isEntryFile: true })),
        writeFile: vi.fn(async () => undefined),
      } as never,
      companySkills: {
        listRuntimeSkillEntries: vi.fn(async () => []),
      } as never,
      paperclipBaseUrl: "http://127.0.0.1:3213/api",
    });

    const result = await service.provisionForAgent("agent-2");

    expect(result.apiUrl).toBe("http://127.0.0.1:3213/api");
    const writeCall = fsMocks.writeFileMock.mock.calls.find(([filePath]) =>
      String(filePath).includes("claimed-api-key.json"),
    );
    expect(writeCall).toBeTruthy();
    expect(String(writeCall?.[1])).toContain('"apiUrl": "http://127.0.0.1:3213/api"');
  });
});
