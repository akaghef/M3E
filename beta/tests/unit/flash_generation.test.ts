// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { connectFlashGeneration } from "../../src/browser/flash_generation";

function setup() {
  document.body.innerHTML = `<select id="flash-source-type"><option value="text">text</option><option value="image">image</option></select>
    <textarea id="v4-source-text">Material</textarea><input id="flash-source-file" type="file">
    <input id="flash-attachments" type="file" multiple><textarea id="flash-instruction"></textarea>
    <button id="flash-generate">生成して保存</button><button id="flash-check" hidden>状態を確認</button>
    <div id="flash-generation-status"></div><div id="flash-destination"></div>`;
  sessionStorage.clear();
  const completed = vi.fn(async () => {});
  const prepare = vi.fn(async () => true);
  const controller = connectFlashGeneration({ destination: () => ({ uri: "m3e://maps/a/nodes/parent", name: "資料", map: "a" }), prepare, completed });
  controller.refresh();
  return { completed, prepare, click: () => (document.getElementById("flash-generate") as HTMLButtonElement).click(), status: () => document.getElementById("flash-generation-status")!.textContent };
}
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });

test("one user submission is saved once even on double click; UI never prints job references", async () => {
  const requests: any[] = [];
  const fetch = vi.fn(async (_url, init) => { requests.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ job_id: "internal-job-reference", state: "succeeded", result: { node_count: 3 } }) }; });
  vi.stubGlobal("fetch", fetch);
  const ui = setup(); ui.click(); ui.click();
  await vi.waitFor(() => expect(ui.completed).toHaveBeenCalledWith("a"));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(requests[0]).toMatchObject({ source: { type: "text", text: "Material" }, attachments: [], target: "m3e://maps/a/nodes/parent" });
  expect(document.body.textContent).not.toContain("internal-job-reference");
});
test("untrusted response errors are not displayed and retry keeps the same request", async () => {
  const requests: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return { ok: false, json: async () => ({ error: "private-host-secret" }) };
  }));
  const ui = setup(); ui.click();
  await vi.waitFor(() => expect(ui.status()).toContain("状態を取得できませんでした"));
  expect(document.body.textContent).not.toContain("private-host-secret");
  (document.getElementById("flash-check") as HTMLButtonElement).click();
  await vi.waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1]).toEqual(requests[0]);
});
