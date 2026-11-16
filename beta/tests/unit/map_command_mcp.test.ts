import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { RapidMvpModel } from "../../src/node/rapid_mvp";
import { M3eMcpService } from "../../src/node/mcp_service";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("MCP Command commit", () => {
  test("an MCP command_id resend does not apply the edit twice", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-mcp-command-"));
    dirs.push(dir);
    const dbPath = path.join(dir, "data.sqlite");
    const mapId = "mcp-command";
    const model = new RapidMvpModel("Root");
    model.saveToSqlite(dbPath, mapId);
    const service = new M3eMcpService({ dbPath: () => dbPath, feedbackDir: () => path.join(dir, "feedback") });
    const entered = service.call("m3e_context", { action: "enter", target: `m3e://maps/${mapId}` });
    const first = service.call("m3e_create", { kind: "node", context_id: entered.context_id, text: "Once", command_id: "c-1" });
    const second = service.call("m3e_create", { kind: "node", context_id: entered.context_id, text: "Twice", command_id: "c-1" });
    expect(first.ok).toBe(true);
    expect(second.replayed).toBe(true);
    const saved = RapidMvpModel.loadSavedMapFromSqlite(dbPath, mapId);
    const texts = Object.values(saved.state.nodes).map((node) => node.text).sort();
    expect(texts).toEqual(["Once", "Root"]);
  });
});
