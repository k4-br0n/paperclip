import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempPaths: string[] = [];

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate test port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempPaths.length > 0) {
    const tempPath = tempPaths.pop();
    if (!tempPath) continue;
    fs.rmSync(tempPath, { recursive: true, force: true });
  }
});

describe("resolveMigrationConnection embedded postgres recovery", () => {
  it("ignores stale postmaster state when pid exists but db is not accepting connections", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-migration-runtime-"));
    tempPaths.push(dataDir);

    fs.writeFileSync(path.join(dataDir, "PG_VERSION"), "16\n");
    const deadPort = await getAvailablePort();
    fs.writeFileSync(
      path.join(dataDir, "postmaster.pid"),
      `${process.pid}\n${dataDir}\n0\n${deadPort}\n`,
    );

    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("PAPERCLIP_HOME", dataDir);

    const client = await import("./client.js");
    const migrationRuntime = await import("./migration-runtime.js");

    const getPostgresDataDirectorySpy = vi
      .spyOn(client, "getPostgresDataDirectory")
      .mockRejectedValue(new Error("connect ECONNREFUSED"));

    const ensurePostgresDatabaseSpy = vi
      .spyOn(client, "ensurePostgresDatabase")
      .mockResolvedValue("created");

    const initialise = vi.fn(async () => {});
    const start = vi.fn(async () => {});
    const stop = vi.fn(async () => {});

    vi.doMock("embedded-postgres", () => ({
      default: class EmbeddedPostgresMock {
        initialise = initialise;
        start = start;
        stop = stop;
      },
    }));

    const warningSpy = vi.spyOn(process, "emitWarning").mockImplementation((_warning: string | Error) => {});

    const result = await migrationRuntime.resolveMigrationConnection();

    expect(start).toHaveBeenCalledTimes(1);
    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining("Ignoring stale embedded PostgreSQL postmaster state"),
    );
    expect(fs.existsSync(path.join(dataDir, "postmaster.pid"))).toBe(false);
    expect(ensurePostgresDatabaseSpy).toHaveBeenCalled();
    expect(getPostgresDataDirectorySpy).toHaveBeenCalled();
    expect(result.connectionString).toContain("/paperclip");

    await result.stop();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
