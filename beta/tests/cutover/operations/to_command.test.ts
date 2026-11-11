import { describe, expect, it } from "vitest";
import { sameCommand, toCommand, unsupportedWritePaths, WRITE_PATHS, mappedWritePaths } from "../../../src/cutover/operations/index";
import type { WritePathRequest } from "../../../src/cutover/operations/index";

const base = (pathId: string, extra: Partial<WritePathRequest> = {}): WritePathRequest => ({
  pathId,
  commandId: "cmd-1",
  baseRevision: "rev-1",
  target: { kind: "node", id: "n-new" },
  ...extra,
});

describe("保存経路から Command への変換", () => {
  it("追加・改名・親変更・削除が Command になり、同じ commandId は同一と判定する", () => {
    const add = toCommand(base("browser.add-child", { commandId: "add-1", payload: { parentId: "parent" } }));
    const rename = toCommand(base("browser.rename", { commandId: "rename-1", target: { kind: "node", id: "n1" }, payload: { text: "新しい名前" } }));
    const reparent = toCommand(base("browser.reparent", { commandId: "reparent-1", target: { kind: "node", id: "n1" }, payload: { parentId: "next" } }));
    const deleted = toCommand(base("browser.delete", { commandId: "delete-1", target: { kind: "node", id: "n1" } }));

    expect(add.status).toBe("対応");
    expect(rename.status).toBe("対応");
    expect(reparent.status).toBe("対応");
    expect(deleted.status).toBe("対応");
    if (add.status !== "対応" || rename.status !== "対応" || reparent.status !== "対応" || deleted.status !== "対応") return;

    expect(add.commands.map((command) => command.intent)).toEqual(["assert"]);
    expect(add.commands[0].commandId).toBe("add-1");
    expect(rename.commands[0]).toMatchObject({ intent: "rename", target: { kind: "node", id: "n1" }, baseRevision: "rev-1", commandId: "rename-1" });
    expect(reparent.commands[0].commandId).toBe("reparent-1");
    expect(deleted.commands[0].commandId).toBe("delete-1");
    expect(reparent.commands[0].intent).toBe("reparent");
    expect(deleted.commands[0].intent).toBe("delete");

    const again = toCommand(base("browser.rename", {
      commandId: "rename-1",
      target: { kind: "node", id: "other" },
      baseRevision: "rev-9",
      payload: { text: "別の text" },
    }));
    expect(again.status).toBe("対応");
    if (again.status !== "対応") return;
    expect(sameCommand(rename.commands[0], again.commands[0])).toBe(true);
    expect(sameCommand(add.commands[0], rename.commands[0])).toBe(false);

    const otherId = toCommand(base("browser.delete", { commandId: "delete-2", target: { kind: "node", id: "n1" } }));
    expect(otherId.status).toBe("対応");
    if (otherId.status !== "対応") return;
    expect(sameCommand(deleted.commands[0], otherId.commands[0])).toBe(false);
  });

  it("同じ入力は同じ Command 列を返す", () => {
    const request = base("mcp.move", { payload: { parentId: "p2" } });
    expect(toCommand(request)).toEqual(toCommand(request));
  });

  it("import は複数 intent でも先頭の commandId を保ち、続きは別 ID にする", () => {
    const result = toCommand(base("import.structure", { payload: { parentId: "p", key: "m3e:flashImportKey", value: "job-1" } }));
    expect(result.status).toBe("対応");
    if (result.status !== "対応") return;
    expect(result.commands.map((command) => command.intent)).toEqual(["assert", "scopen", "set-attribute"]);
    expect(result.commands[0].commandId).toBe("cmd-1");
    expect(new Set(result.commands.map((command) => command.commandId)).size).toBe(3);
    expect(sameCommand(result.commands[0], result.commands[1])).toBe(false);
  });

  it("未対応の入口は Command を作らない", () => {
    const names = unsupportedWritePaths().map((path) => path.id);
    expect(names).toEqual(expect.arrayContaining([
      "browser.derived-sync",
      "browser.concreteness",
      "vault.file-missing",
      "vault.write-through",
      "cloud.pull",
      "home.duplicate",
      "home.delete",
      "startup.legacy-id-migration",
      "startup.schema-migration",
      "startup.engine-backup",
    ]));
    for (const id of names) {
      const result = toCommand(base(id));
      expect(result.status).toBe("未対応");
      expect(result).not.toHaveProperty("commands");
    }
    expect(WRITE_PATHS.map((path) => path.id)).not.toContain("startup.ensure-map-rewrite");
  });

  it("起動時の新規作成は load であり、既存 map の書き換え経路は対応付けない", () => {
    const created = toCommand({
      pathId: "startup.ensure-create",
      commandId: "boot-1",
      baseRevision: "absent",
      target: { kind: "map", id: "map-1" },
      payload: { label: "開発" },
    });
    expect(created.status).toBe("対応");
    if (created.status !== "対応") return;
    expect(created.commands[0]).toMatchObject({ intent: "load", commandId: "boot-1", baseRevision: "absent" });
  });

  it("入口の id は一意で、依頼された区分をすべて含む", () => {
    const ids = WRITE_PATHS.map((path) => path.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(WRITE_PATHS.map((path) => path.category))).toEqual(new Set([
      "ブラウザ保存", "MCP", "import", "linear-text", "GraphLink", "Vault", "collab", "cloud", "backup restore", "Home", "起動時",
    ]));
    expect(mappedWritePaths().length).toBeGreaterThan(0);
    expect(unsupportedWritePaths().every((path) => path.reason.trim().length > 0)).toBe(true);
  });

  it("不足した入力は Command にしない", () => {
    expect(toCommand(base("browser.add-child")).status).toBe("拒否");
    expect(toCommand(base("unknown.path")).status).toBe("拒否");
  });

  it("全体置換の差分を assert / rename / reparent / delete に分解し、それ以外は残余にする", () => {
    const result = toCommand(base("browser.whole-state-post", {
      commandId: "save-1",
      target: { kind: "map", id: "map-1" },
      before: {
        nodes: [
          { id: "r", parentId: null, text: "Root", children: ["a", "b"] },
          { id: "a", parentId: "r", text: "A", children: [], attributes: { mark: "1", old: "z" } },
          { id: "b", parentId: "r", text: "B", children: ["c"] },
          { id: "c", parentId: "b", text: "C", children: [] },
        ],
        links: [{ id: "l1", sourceNodeId: "a", targetNodeId: "b", label: "old" }],
        opaque: { "node:a.collapsed": "false" },
      },
      after: {
        nodes: [
          { id: "r", parentId: null, text: "Root2", children: ["b", "d"] },
          { id: "a", parentId: "b", text: "A2", children: [], attributes: { mark: "2" } },
          { id: "b", parentId: "r", text: "B", children: ["a"] },
          { id: "d", parentId: "r", text: "D", children: [] },
        ],
        links: [{ id: "l1", sourceNodeId: "a", targetNodeId: "d", label: "next" }, { id: "l2", sourceNodeId: "d", targetNodeId: "b" }],
        opaque: { "node:a.collapsed": "true" },
      },
    }));
    expect(result.status).toBe("対応");
    if (result.status !== "対応") return;
    expect(result.commands.map((command) => command.intent)).toEqual([
      "delete", "assert", "reparent", "rename", "rename", "set-attribute", "unset-attribute", "assert", "retarget", "set-attribute",
    ]);
    expect(result.commands.map((command) => command.target.id)).toEqual(["c", "d", "a", "a", "r", "a", "a", "l2", "l1", "l1"]);
    expect(result.commands[0].commandId).toBe("save-1");
    expect(result.commands[2]).toMatchObject({ intent: "reparent", payload: { parentId: "b" } });
    expect(result.commands[5]).toMatchObject({ intent: "set-attribute", payload: { key: "mark", value: "2" } });
    expect(result.commands[8]).toMatchObject({ intent: "retarget", payload: { sourceNodeId: "a", targetNodeId: "d" } });
    expect(result.commands[9]).toMatchObject({ intent: "set-attribute", payload: { key: "label", value: "next" } });
    expect(result.unmapped?.map((item) => item.id)).toEqual(["opaque:node:a.collapsed"]);
    expect(toCommand(base("browser.whole-state-post", {
      commandId: "order-1",
      target: { kind: "map", id: "map-1" },
      before: { nodes: [
        { id: "r", parentId: null, text: "Root", children: ["a", "b"] },
        { id: "a", parentId: "r", text: "A", children: [] },
        { id: "b", parentId: "r", text: "B", children: [] },
      ] },
      after: { nodes: [
        { id: "r", parentId: null, text: "Root", children: ["b", "a"] },
        { id: "a", parentId: "r", text: "A", children: [] },
        { id: "b", parentId: "r", text: "B", children: [] },
      ] },
    }))).toMatchObject({
      status: "対応",
      commands: [{ intent: "reorder", target: { kind: "node", id: "r" }, payload: { childIds: "b,a" } }],
    });
  });

  it("注釈、Surface、linear-text を Command にする", () => {
    const added = toCommand(base("browser.annotation", { target: { kind: "annotation", id: "pen-1" }, payload: { action: "assert" } }));
    const erased = toCommand(base("browser.annotation", { target: { kind: "annotation", id: "pen-1" }, payload: { action: "delete" } }));
    const surface = toCommand(base("browser.surface-layout", { target: { kind: "surface", id: "surface-1" }, payload: { key: "direction", value: "right" } }));
    const put = toCommand(base("linear-text.put", { payload: { value: "本文" } }));
    const edited = toCommand(base("linear-text.edit", { payload: { value: "本文" } }));
    const removed = toCommand(base("linear-text.delete"));
    expect(added.status).toBe("対応");
    expect(erased.status).toBe("対応");
    expect(surface.status).toBe("対応");
    expect(put.status).toBe("対応");
    expect(edited.status).toBe("対応");
    expect(removed.status).toBe("対応");
    if (added.status !== "対応" || erased.status !== "対応" || surface.status !== "対応" || put.status !== "対応" || removed.status !== "対応") return;
    expect(added.commands[0].intent).toBe("assert");
    expect(erased.commands[0].intent).toBe("delete");
    expect(surface.commands[0]).toMatchObject({ intent: "view", target: { kind: "surface", id: "surface-1" } });
    expect(put.commands[0]).toMatchObject({ intent: "set-attribute", payload: { key: "linear-text", value: "本文" } });
    expect(edited.commands[0].intent).toBe("set-attribute");
    expect(removed.commands[0]).toMatchObject({ intent: "unset-attribute", payload: { key: "linear-text" } });

    const applied = toCommand(base("linear-text.apply", {
      commandId: "apply-1",
      target: { kind: "node", id: "s" },
      linearApply: {
        scopeRootId: "s",
        nodes: [
          { id: "s", parentId: null, text: "S", children: ["a", "b"] },
          { id: "a", parentId: "s", text: "A", children: [] },
          { id: "b", parentId: "s", text: "B", children: [] },
        ],
        draft: { label: "S2", children: [{ label: "A2" }, { label: "B" }, { label: "New" }] },
      },
    }));
    expect(applied.status).toBe("対応");
    if (applied.status !== "対応") return;
    expect(applied.commands.map((command) => [command.intent, command.target.id])).toEqual([
      ["rename", "s"],
      ["rename", "a"],
      ["assert", "apply-1:new:2"],
    ]);
    expect(applied.commands[2].payload).toMatchObject({ parentId: "s", text: "New" });
  });

  it("強制置換は同じ分解を使い、親の挿入は assert と reparent になる", () => {
    const forced = toCommand(base("browser.force", {
      target: { kind: "map", id: "map-1" },
      before: { nodes: [
        { id: "r", parentId: null, text: "Root", children: ["a"] },
        { id: "a", parentId: "r", text: "A", children: [] },
      ] },
      after: { nodes: [
        { id: "r", parentId: null, text: "Root", children: [] },
      ] },
    }));
    expect(forced.status).toBe("対応");
    if (forced.status !== "対応") return;
    expect(forced.commands.map((command) => command.intent)).toEqual(["delete"]);

    const grouped = toCommand(base("browser.group-selected", {
      commandId: "group-1",
      target: { kind: "node", id: "parent-new" },
      payload: { parentId: "r", text: "束", childIds: "a,b" },
    }));
    expect(grouped.status).toBe("対応");
    if (grouped.status !== "対応") return;
    expect(grouped.commands.map((command) => [command.intent, command.target.id])).toEqual([
      ["assert", "parent-new"],
      ["reparent", "a"],
      ["reparent", "b"],
    ]);
  });
});
