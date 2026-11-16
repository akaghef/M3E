import { afterEach, expect, test, vi } from "vitest";
import { buildSaveCommand, postSaveCommand } from "../../src/browser/save_command";

const node = (text: string) => ({ id: "root", parentId: null, children: [], nodeType: "text", text, collapsed: false, details: "", note: "", attributes: {}, link: "" });
const state = (text: string) => ({ rootId: "root", nodes: { root: node(text) } });
const ok = (payload: object = { ok: true, savedAt: "t1" }) => new Response(JSON.stringify(payload), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

test("the same edit made again after it was confirmed is a new Command", async () => {
  const fetch = vi.fn().mockImplementation(async () => ok());
  vi.stubGlobal("fetch", fetch);
  // Rename A -> B, back to A, then A -> B again: the first and third saves carry identical changes.
  await postSaveCommand("/api/maps/m", "tab", state("A"), state("B"), "t0", () => "whole");
  await postSaveCommand("/api/maps/m", "tab", state("B"), state("A"), "t1", () => "whole");
  await postSaveCommand("/api/maps/m", "tab", state("A"), state("B"), "t2", () => "whole");
  const sent = fetch.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
  expect(sent[0].changes).toEqual(sent[2].changes);
  expect(new Set(sent.map((command) => command.commandId)).size).toBe(3);
});

test("a resend of the identical unconfirmed edit reuses the commandId", async () => {
  const fetch = vi.fn()
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockImplementationOnce(async () => new Response("{}", { status: 503 }))
    .mockImplementationOnce(async () => ok());
  vi.stubGlobal("fetch", fetch);
  const send = () => postSaveCommand("/api/maps/m", "tab", state("A"), state("resend"), "t0", () => "whole");
  await expect(send()).rejects.toThrow("Failed to fetch");
  expect((await send()).status).toBe(503);
  expect((await send()).status).toBe(200);
  const ids = fetch.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)).commandId);
  expect(new Set(ids).size).toBe(1);
  // Confirmed now, so the next identical edit is a new Command.
  expect(buildSaveCommand(state("A"), state("resend"), "tab").commandId).not.toBe(ids[0]);
});

test("no changes sends nothing and answers as already saved", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const response = await postSaveCommand("/api/maps/m", "tab", state("A"), state("A"), "t0", () => "whole");
  expect(fetch).not.toHaveBeenCalled();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, savedAt: "t0" });
});

test("a map without a row falls back to the whole-map save", async () => {
  const fetch = vi.fn()
    .mockImplementationOnce(async () => new Response("{}", { status: 404 }))
    .mockImplementationOnce(async () => ok());
  vi.stubGlobal("fetch", fetch);
  const wholeBody = vi.fn(() => "whole-body");
  const response = await postSaveCommand("/api/maps/m", "tab", state("A"), state("B"), "t0", wholeBody);
  expect(response.status).toBe(200);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/maps/m/commands", "/api/maps/m"]);
  expect((fetch.mock.calls[1]![1] as RequestInit).body).toBe("whole-body");
  expect(wholeBody).toHaveBeenCalledTimes(1);
});
