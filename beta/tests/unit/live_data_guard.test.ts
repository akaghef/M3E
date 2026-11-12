import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RapidMvpModel } from "../../src/node/rapid_mvp";

// The personal workspace lives under <home>/Library/Application Support/M3E.
// HOME points at a temporary directory here, so the real one is never touched.
describe("personal workspace guard", () => {
  let home = "";
  const saved = { HOME: process.env.HOME, guard: process.env.M3E_FORBID_LIVE_DATA };

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-live-guard-"));
    process.env.HOME = home;
  });

  afterEach(() => {
    process.env.HOME = saved.HOME;
    if (saved.guard === undefined) delete process.env.M3E_FORBID_LIVE_DATA;
    else process.env.M3E_FORBID_LIVE_DATA = saved.guard;
    fs.rmSync(home, { recursive: true, force: true });
  });

  function workspaceDb(): string {
    return path.join(home, "Library", "Application Support", "M3E", "workspaces", "ws", "data.sqlite");
  }

  it("lets the normal runtime open its own workspace database", () => {
    delete process.env.M3E_FORBID_LIVE_DATA;
    expect(os.homedir()).toBe(home);
    expect(RapidMvpModel.mapExists(workspaceDb(), "missing")).toBe(false);
    expect(fs.existsSync(workspaceDb())).toBe(true);
  });

  it("refuses the workspace database when a test run forbids it", () => {
    process.env.M3E_FORBID_LIVE_DATA = "1";
    expect(() => RapidMvpModel.mapExists(workspaceDb(), "missing")).toThrow(/live M3E database/);
    expect(fs.existsSync(workspaceDb())).toBe(false);
  });
});
