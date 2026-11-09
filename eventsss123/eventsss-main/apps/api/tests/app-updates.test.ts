import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { clearAppUpdateCache } from "../src/modules/app-updates/app-updates.routes";

const app = createApp();
const releaseMetadata = () => new Response(JSON.stringify({
  assets: [
    { name: "version.json", browser_download_url: "https://github.com/example/version.json" },
    { name: "ephinta-web-bundle.zip", browser_download_url: "https://github.com/example/ephinta-web-bundle.zip" },
  ],
}), { status: 200, headers: { "Content-Type": "application/json" } });

describe("public mobile OTA endpoints", () => {
  beforeEach(() => {
    clearAppUpdateCache();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearAppUpdateCache();
  });

  it("rewrites the manifest to a same-API-origin bundle URL and allows the mobile webview", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(releaseMetadata())
      .mockResolvedValueOnce(new Response(JSON.stringify({
        version: "e2b8ccebada1",
        url: "https://github.com/demtaiwo1-eng/Winning-game-/releases/download/ephinta-web-latest/ephinta-web-bundle.zip",
      }), { status: 200 }));

    const response = await request(app)
      .get("/api/v1/app-updates/version.json")
      .set("Origin", "https://localhost");

    expect(response.status).toBe(200);
    expect(vi.mocked(fetch)).toHaveBeenNthCalledWith(
      1,
      "https://api.github.com/repos/demtaiwo1-eng/Winning-game-/releases/tags/ephinta-web-latest",
      expect.objectContaining({ headers: expect.objectContaining({ Accept: "application/vnd.github+json" }) }),
    );
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(response.body).toEqual({ version: "e2b8ccebada1", url: "ephinta-web-bundle.zip?v=e2b8ccebada1", updateType: "web" });
  });

  it("falls back to the current latest release while the dedicated OTA tag is not yet available", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(releaseMetadata())
      .mockResolvedValueOnce(new Response(JSON.stringify({
        version: "legacy-ota-version",
        url: "https://github.com/demtaiwo1-eng/Winning-game-/releases/latest/download/ephinta-web-bundle.zip",
      }), { status: 200 }));

    const response = await request(app).get("/api/v1/app-updates/version.json");

    expect(response.status).toBe(200);
    expect(response.body.version).toBe("legacy-ota-version");
    expect(vi.mocked(fetch)).toHaveBeenNthCalledWith(
      1,
      "https://api.github.com/repos/demtaiwo1-eng/Winning-game-/releases/tags/ephinta-web-latest",
      expect.any(Object),
    );
    expect(vi.mocked(fetch)).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/repos/demtaiwo1-eng/Winning-game-/releases/latest",
      expect.any(Object),
    );
  });

  it("returns safe update title and release message for connected app notices", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(releaseMetadata())
      .mockResolvedValueOnce(new Response(JSON.stringify({
        version: "patch-20261109",
        url: "https://github.com/demtaiwo1-eng/Winning-game-/releases/download/ephinta-web-latest/ephinta-web-bundle.zip",
        title: "EPHINTA improvements",
        message: "Dashboard fixes and faster loading <script>alert(1)</script>",
        publishedAt: "2026-11-09T12:00:00.000Z",
      }), { status: 200 }));

    const response = await request(app).get("/api/v1/app-updates/version.json");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      version: "patch-20261109",
      title: "EPHINTA improvements",
      message: "Dashboard fixes and faster loading scriptalert(1)/script",
      publishedAt: "2026-11-09T12:00:00.000Z",
      updateType: "web",
    });
  });

  it("streams the OTA zip with cross-origin download headers", async () => {
    const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02]);
    vi.mocked(fetch)
      .mockResolvedValueOnce(releaseMetadata())
      .mockResolvedValueOnce(new Response(bytes, {
        status: 200,
        headers: { "Content-Type": "application/zip", "Content-Length": String(bytes.length) },
      }));

    const response = await request(app)
      .get("/api/v1/app-updates/ephinta-web-bundle.zip")
      .set("Origin", "https://localhost")
      .buffer(true)
      .parse((stream, callback) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        stream.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.headers["content-type"]).toContain("application/zip");
    expect(response.body).toEqual(bytes);
  });
});
