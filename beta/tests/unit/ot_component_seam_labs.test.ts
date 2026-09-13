import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { OT_NATIVE_FIXTURES } from "../../src/labs/ot/fixtures/ot_native_fixtures";

const root = resolve(import.meta.dirname, "../..");
const otRoot = resolve(root, "src/labs/ot");
const manifest = JSON.parse(readFileSync(resolve(otRoot, "provenance.json"), "utf8"));
const viteConfig = readFileSync(resolve(root, "vite.config.mjs"), "utf8");
const components = ["deck", "network", "detail", "edge", "mail", "replay", "runtime"] as const;

describe("OT Component Seam Labs", () => {
  test("fixture keeps upstream payload vocabulary and shapes", () => {
    expect(OT_NATIVE_FIXTURES.agents[0]).toHaveProperty("act_state");
    expect(OT_NATIVE_FIXTURES.messages[0]).toMatchObject({ sender: expect.any(String), recipient: expect.any(String), kind: "to" });
    expect(OT_NATIVE_FIXTURES.graph.spawn[0]).toMatchObject({ source: expect.any(String), target: expect.any(String), type: "spawn" });
    expect(OT_NATIVE_FIXTURES.spawnPayload).toHaveProperty("worktree");
    expect(JSON.stringify(OT_NATIVE_FIXTURES)).not.toMatch(/Role|Task|Attention|GraphLink/);
  });

  test("manifest covers all seven routes and pinned source identity", () => {
    expect(manifest.source_commit).toBe("22ffe6483530e643c8fc1af486319990e0181de4");
    expect(manifest.license.required_notice).toBe("Copyright (c) 2026 gyroid");
    expect(Object.keys(manifest.labs)).toEqual([...components]);
    for (const name of components) {
      const lab = manifest.labs[name];
      expect(lab.route).toBe(`/src/labs/ot/routes/${name}.html`);
      expect(lab.cut).toEqual([`cut/${name}/logic.js`, `cut/${name}/markup.html`]);
    }
  });

  test("each component has physical verbatim fragments and each route loads its harness", () => {
    for (const name of components) {
      expect(existsSync(resolve(otRoot, "cut", name, "logic.js"))).toBe(true);
      expect(existsSync(resolve(otRoot, "cut", name, "markup.html"))).toBe(true);
      const route = readFileSync(resolve(otRoot, "routes", `${name}.html`), "utf8");
      expect(route).not.toMatch(/iframe|upstream\/index\.html|lab=/i);
      expect(route).toContain(`entries/${name}.ts`);
      expect(route).toContain("../cut/shared/dashboard.css");
    }
    expect(existsSync(resolve(otRoot, "upstream/index.html"))).toBe(false);
  });

  test("harnesses only mount and load cuts; OT algorithms remain in fragments", () => {
    for (const name of components) {
      const harness = readFileSync(resolve(otRoot, "entries", `${name}.ts`), "utf8");
      expect(harness).toContain(`cut/${name}/logic.js`);
      expect(harness).not.toMatch(/force\s*[+=]|setInterval|simulation|mailDrain|_rbApplyStateOnly|openSpawnModal|submitSpawn/);
    }
    expect(readFileSync(resolve(otRoot, "shared/render.ts"), "utf8")).not.toMatch(/force\s*[+=]|setInterval|simulation/);
  });

  test("hub keeps seven direct route links and no hiddenByLab", () => {
    const hub = readFileSync(resolve(root, "src/labs/index.html"), "utf8");
    expect((hub.match(/src\/labs\/ot\/routes\//g) || []).length).toBe(7);
    expect(hub).not.toContain("hiddenByLab");
  });

  test("runtime safe adapter blocks POST but permits fixture GET", async () => {
    const { installOtSafeFetch } = await import("../../src/labs/ot/shared/safe_fetch");
    const requests: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(`${init?.method || "GET"} ${String(input)}`);
      return new Response(JSON.stringify({ agents: OT_NATIVE_FIXTURES.agents }), { status: 200 });
    }) as typeof fetch;
    const restore = installOtSafeFetch();
    await expect(fetch("/api/agents")).resolves.toMatchObject({ status: 200 });
    await expect(fetch("/api/spawn", { method: "POST", body: "{}" })).resolves.toMatchObject({ status: 403 });
    restore();
    globalThis.fetch = original;
    expect(requests).toEqual(["GET /api/agents"]);
  });

  test("provenance proves exact bytes and rejects a mutation", async () => {
    const { validateOtProvenance } = await import("../../scripts/ot_provenance_lib.mjs");
    const result = validateOtProvenance(root, "/tmp/orrery-telemetry-inspect");
    expect(result.ok, result.errors.join("\n")).toBe(true);
    expect(manifest.fragments.length).toBe(14);
    expect(manifest.styles[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    const tempRoot = mkdtempSync(resolve(tmpdir(), "m3e-ot-provenance-"));
    try {
      cpSync(otRoot, resolve(tempRoot, "src/labs/ot"), { recursive: true });
      const mutationPath = resolve(tempRoot, "src/labs/ot/cut/network/logic.js");
      writeFileSync(mutationPath, readFileSync(mutationPath, "utf8") + "\nMUTATION\n");
      const mutated = validateOtProvenance(tempRoot, "/tmp/orrery-telemetry-inspect");
      expect(mutated.ok).toBe(false);
      expect(mutated.errors.join("\n")).toMatch(/network\/logic\.js: (sha256 drift|bytes are not a verbatim upstream substring|bytes differ)/);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("binary assets remain fixture-referenced only", () => {
    expect(manifest.assets.map((asset: { path: string }) => asset.path)).toEqual([
      "upstream/portraits_64/Lovelace.png",
      "upstream/portraits_64/Turing.png",
      "upstream/portraits_64/Curie.png",
    ]);
  });
});

