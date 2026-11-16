import { afterEach, beforeEach, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RapidMvpModel } from "../../src/node/rapid_mvp";
import { M3eMcpService } from "../../src/node/mcp_service";
import { FlashJobs, FlashProvider } from "../../src/node/flash_jobs";

let dir: string, db: string, manager: M3eMcpService, target: string, parent: string, jobs: FlashJobs;
const map = "flash-test";
const graph = { roots: ["a"], nodes: [{ id: "a", title: "Research", parent: null, children: ["b"] }, { id: "b", title: "Question", parent: "a", children: [] }] };
let submitted: number;
let provider: FlashProvider;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "flash-jobs-")); db = path.join(dir, "maps.sqlite");
  const model = new RapidMvpModel("Test"); parent = model.addNode(model.state.rootId, "thread"); model.addNode(model.state.rootId, "Keep"); model.saveToSqlite(db, map);
  target = `m3e://maps/${map}/nodes/${parent}`;
  manager = new M3eMcpService({ dbPath: () => db, feedbackDir: () => dir }); submitted = 0;
  provider = { async call(route) { if (route === "/v1/jobs") { submitted++; return { job_id: "remote" }; } return route.endsWith("/structure") ? graph : { state: "succeeded" }; } };
  jobs = new FlashJobs(path.join(dir, "jobs"), manager, provider, 5);
});
afterEach(() => { jobs.close(); fs.rmSync(dir, { recursive: true, force: true }); });
const request = () => ({ request_id: "once", target, source: { type: "text", text: "research source" } });
async function completed(id: string) { for (let i = 0; i < 100; i++) { const j = jobs.get(id); if (j.state !== "processing") return j; await new Promise(r => setTimeout(r, 5)); } throw new Error("timeout"); }
const state = () => RapidMvpModel.loadFromSqlite(db, map).state;

test("real Core appends one scope below specified parent; concurrent replays do not regenerate", async () => {
  const before = state(); const a = jobs.submit(request()); const b = jobs.submit(request()); expect(b.job_id).toBe(a.job_id);
  const result = await completed(a.job_id); expect(result.state).toBe("succeeded"); expect(submitted).toBe(1);
  const after = state(), children = after.nodes[parent].children;
  expect(children).toHaveLength(1); expect(after.nodes[children[0]].nodeType).toBe("folder");
  expect(after.nodes[after.nodes[children[0]].children[0]].text).toBe("Question");
  expect(after.nodes[before.rootId]).toEqual(before.nodes[before.rootId]);
  expect(jobs.submit(request()).result.scope.uri).toBe(result.result.scope.uri);
  expect(() => jobs.submit({ ...request(), source: { type: "text", text: "changed" } })).toThrow("different input");
});
test("provider failure leaves the map unchanged", async () => {
  const before = state(); provider.call = async route => route === "/v1/jobs" ? { job_id: "bad" } : { state: "failed" };
  expect((await completed(jobs.submit(request()).job_id)).state).toBe("failed"); expect(state()).toEqual(before);
});
test("malformed generated tree is rejected atomically", async () => {
  const before = state(); provider.call = async route => route === "/v1/jobs" ? { job_id: "bad" } : route.endsWith("/structure") ? { ...graph, nodes: [...graph.nodes, { id: "lost", title: "orphan", parent: null, children: [] }] } : { state: "succeeded" };
  expect((await completed(jobs.submit(request()).job_id)).state).toBe("failed"); expect(state()).toEqual(before);
});
test("crash after map commit before job success resumes without a duplicate scope", async () => {
  const id = jobs.submit(request()).job_id; await completed(id); jobs.close();
  const file = path.join(dir, "jobs", id + ".json"), record = JSON.parse(fs.readFileSync(file, "utf8"));
  record.state = "processing"; delete record.result; fs.writeFileSync(file, JSON.stringify(record));
  jobs = new FlashJobs(path.join(dir, "jobs"), manager, provider, 5); jobs.resume();
  const result = await completed(id); expect(result.state).toBe("succeeded"); expect(result.result.replayed).toBe(true);
  expect(state().nodes[parent].children).toHaveLength(1); expect(submitted).toBe(1);
});
test("missing destination is rejected before generation", () => {
  expect(() => jobs.submit({ ...request(), target: `m3e://maps/${map}/nodes/missing` })).toThrow("Target unavailable"); expect(submitted).toBe(0);
});

test("multiline source text is preserved in the saved tree", async () => {
  const multiline = "Formula\nExplanation";
  provider.call = async route => route === "/v1/jobs" ? { job_id: "remote" } : route.endsWith("/structure") ? { ...graph, nodes: graph.nodes.map(n => n.id === "b" ? { ...n, title: multiline } : n) } : { state: "succeeded" };
  const result = await completed(jobs.submit(request()).job_id);
  expect(result.state).toBe("succeeded");
  const root = state().nodes[parent].children[0];
  expect(state().nodes[state().nodes[root].children[0]].text).toBe(multiline);
});
test("import retry reuses the generated result and survives concurrent requests without duplication", async () => {
  const call = manager.call.bind(manager);
  manager.call = (name, args) => name === "m3e_create" ? { ok: false, error: { code: "IMPORT_FAILED" } } : call(name, args);
  const id = jobs.submit(request()).job_id;
  expect((await completed(id)).state).toBe("failed");
  expect(state().nodes[parent].children).toHaveLength(0);
  manager.call = call;
  await Promise.all([jobs.retryImport(id), jobs.retryImport(id)]);
  expect((await completed(id)).state).toBe("succeeded");
  await jobs.retryImport(id);
  expect(submitted).toBe(1);
  expect(state().nodes[parent].children).toHaveLength(1);
});
test("import retry refuses a provider rejection without a new generation", async () => {
  provider.call = async route => { if (route === "/v1/jobs") { submitted++; return { job_id: "rejected" }; } return { state: "failed" }; };
  const id = jobs.submit(request()).job_id;
  expect((await completed(id)).state).toBe("failed");
  await expect(jobs.retryImport(id)).rejects.toThrow("cannot regenerate");
  expect(submitted).toBe(1);
  expect(state().nodes[parent].children).toHaveLength(0);
});

const attachment = (type = "document") => ({ type, filename: "source.txt", mime_type: "text/plain", base64: "bWF0ZXJpYWw=" });
test("multimodal sources and additional attachments reach the existing provider unchanged", async () => {
  const requests: any[] = [];
  provider.call = async (route, body) => { if (route === "/v1/jobs") { requests.push(body); return { job_id: "remote" }; } return route.endsWith("/structure") ? graph : { state: "succeeded" }; };
  for (const type of ["document", "image", "audio", "video"]) {
    const source = attachment(type), attachments = [attachment("image"), attachment("audio")];
    const result = await completed(jobs.submit({ ...request(), request_id: type, source, attachments }).job_id);
    expect(result.state).toBe("succeeded");
    expect(requests.at(-1)).toMatchObject({ source, attachments });
  }
});
test("attachments participate in retry identity; unsupported file input cannot start generation", async () => {
  const input = { ...request(), attachments: [attachment()] };
  const id = jobs.submit(input).job_id; await completed(id);
  expect(jobs.submit(input).job_id).toBe(id);
  expect(() => jobs.submit({ ...input, attachments: [attachment("image")] })).toThrow("different input");
  expect(() => jobs.submit({ ...request(), request_id: "too-many", attachments: Array(11).fill(attachment()) })).toThrow();
  for (const file of [{ ...attachment(), path: "/private/source" }, { ...attachment(), filename: "../source" }, { ...attachment(), base64: "invalid!" }, null]) {
    expect(() => jobs.submit({ ...request(), request_id: "invalid", attachments: [file] })).toThrow();
  }
  expect(submitted).toBe(1);
});
test("provider internals are absent from public status and retry errors", async () => {
  provider.call = async route => route === "/v1/jobs" ? { job_id: "private-host-and-token" } : { state: "failed", error: "private-host-and-token" };
  const id = jobs.submit(request()).job_id;
  expect(JSON.stringify(await completed(id))).not.toContain("private-host-and-token");
  provider.call = async () => { throw new Error("private-host-and-token"); };
  const { flashPublicError } = await import("../../src/node/flash_jobs");
  try { await jobs.retryImport(id); } catch (error) { expect(flashPublicError(error)).not.toContain("private-host-and-token"); }
  expect(flashPublicError(new SyntaxError("private-host-and-token"))).not.toContain("private-host-and-token");
});
