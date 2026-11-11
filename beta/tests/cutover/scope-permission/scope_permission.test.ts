import { describe, expect, it } from "vitest";
import {
  admitToAccount,
  aliasAccessAlternate,
  canReadScope,
  canSendScope,
  canWriteScope,
  decideScopePermission,
  filterScopeChangeSequences,
  type ScopeChangeSequence,
  type ScopeGrant,
  type WorkspaceAccount,
} from "../../../src/cutover/scope-permission";

const workspace: WorkspaceAccount = { accountId: "acct-1", workspaceId: "ws-1" };
const outsider = "acct-other";
const member = "acct-1";

const grants: readonly ScopeGrant[] = [
  { scopeId: "scope-read", capability: "read" },
  { scopeId: "scope-write", capability: "write" },
  { scopeId: "scope-both", capability: "read" },
  { scopeId: "scope-both", capability: "write" },
];

describe("account boundary", () => {
  it("admits only the workspace account", () => {
    expect(admitToAccount(member, workspace)).toBe(true);
    expect(admitToAccount(outsider, workspace)).toBe(false);
    expect(admitToAccount("", workspace)).toBe(false);
    expect(admitToAccount(member, { accountId: "", workspaceId: "ws-1" })).toBe(false);
    expect(admitToAccount(member, { accountId: "acct-1", workspaceId: "" })).toBe(false);
  });

  it("denies read, write, and send outside the account", () => {
    for (const scopeId of ["scope-read", "scope-write", "scope-both", "scope-missing"]) {
      const decision = decideScopePermission(outsider, workspace, grants, scopeId);
      expect(decision).toEqual({ admitted: false, read: false, write: false, send: false });
      expect(canReadScope(outsider, workspace, grants, scopeId)).toBe(false);
      expect(canWriteScope(outsider, workspace, grants, scopeId)).toBe(false);
      expect(canSendScope(outsider, workspace, grants, scopeId)).toBe(false);
    }
    const sequences: ScopeChangeSequence<string>[] = [
      { scopeId: "scope-write", changes: ["edit"] },
      { scopeId: "scope-read", changes: ["look"] },
    ];
    const snapshot = structuredClone(sequences);
    expect(filterScopeChangeSequences(outsider, workspace, grants, sequences)).toEqual([
      { scopeId: "scope-write", changes: [] },
      { scopeId: "scope-read", changes: [] },
    ]);
    expect(sequences).toEqual(snapshot);
  });
});

describe("scope send permission", () => {
  it("does not send a read-only scope", () => {
    const decision = decideScopePermission(member, workspace, grants, "scope-read");
    expect(decision).toEqual({ admitted: true, read: true, write: false, send: false });
    expect(canSendScope(member, workspace, grants, "scope-read")).toBe(false);
    const sequences = [{ scopeId: "scope-read", changes: ["look", "again"] }];
    expect(filterScopeChangeSequences(member, workspace, grants, sequences)).toEqual([
      { scopeId: "scope-read", changes: [] },
    ]);
  });

  it("sends only scopes with write permission", () => {
    expect(decideScopePermission(member, workspace, grants, "scope-write")).toEqual({
      admitted: true,
      read: true,
      write: true,
      send: true,
    });
    expect(canReadScope(member, workspace, grants, "scope-write")).toBe(true);
    expect(canWriteScope(member, workspace, grants, "scope-write")).toBe(true);
    expect(canSendScope(member, workspace, grants, "scope-write")).toBe(true);
    expect(decideScopePermission(member, workspace, grants, "scope-both").send).toBe(true);
    expect(decideScopePermission(member, workspace, grants, "scope-missing")).toEqual({
      admitted: true,
      read: false,
      write: false,
      send: false,
    });

    const writeChanges = ["edit-a", "edit-b"];
    const sequences: ScopeChangeSequence<string>[] = [
      { scopeId: "scope-read", changes: ["look"] },
      { scopeId: "scope-write", changes: writeChanges },
      { scopeId: "scope-missing", changes: ["stray"] },
      { scopeId: "scope-both", changes: ["kept"] },
    ];
    const filtered = filterScopeChangeSequences(member, workspace, grants, sequences);
    expect(filtered).toEqual([
      { scopeId: "scope-read", changes: [] },
      { scopeId: "scope-write", changes: ["edit-a", "edit-b"] },
      { scopeId: "scope-missing", changes: [] },
      { scopeId: "scope-both", changes: ["kept"] },
    ]);
    expect(filtered[1].changes).not.toBe(writeChanges);
    expect(writeChanges).toEqual(["edit-a", "edit-b"]);
  });

  it("does not let an alias access proposal authorize send", () => {
    const readScope = decideScopePermission(member, workspace, grants, "scope-read");
    const alternate = aliasAccessAlternate({ aliasId: "alias-1", access: "write" });
    expect(alternate).toEqual({ proposal: "alias-access", consulted: false, access: "write" });
    expect(readScope.send).toBe(false);
    expect(canSendScope(member, workspace, grants, "scope-read")).toBe(false);
  });
});
