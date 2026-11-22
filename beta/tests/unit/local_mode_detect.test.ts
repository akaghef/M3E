import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { localModeRemote } from "../../src/node/record_store/active";

describe("localModeRemote", () => {
  it("is M3E_SYNC_REMOTE when set, the recorded origin of a clone otherwise, null for a non-clone", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-local-detect-"));
    expect(localModeRemote({ M3E_DATA_DIR: dir })).toBeNull();
    expect(localModeRemote({ M3E_DATA_DIR: dir, M3E_SYNC_REMOTE: "https://r.tail1.ts.net" })).toBe("https://r.tail1.ts.net");
    fs.mkdirSync(path.join(dir, "sync"));
    fs.writeFileSync(path.join(dir, "sync", "remote.json"), JSON.stringify({ origin: "https://mini.tail1.ts.net" }));
    expect(localModeRemote({ M3E_DATA_DIR: dir })).toBe("https://mini.tail1.ts.net");
    fs.writeFileSync(path.join(dir, "sync", "remote.json"), JSON.stringify({}));
    expect(() => localModeRemote({ M3E_DATA_DIR: dir })).toThrow();
  });
});
