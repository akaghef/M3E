import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import ts from "typescript";
import { expect, test, vi } from "vitest";

// Diagnostic coverage of the real reader; HTTP acceptance is in large_map_save_api.
const source = ts.createSourceFile("start_viewer.ts", fs.readFileSync(path.join(__dirname, "../../src/node/start_viewer.ts"), "utf8"), ts.ScriptTarget.Latest, true);
const statements = source.statements.filter(s =>
  (ts.isFunctionDeclaration(s) && ["readRequestBody", "sendJson"].includes(s.name?.text ?? "")) ||
  (ts.isVariableStatement(s) && s.declarationList.declarations.some(d => d.name.getText(source) === "MAP_STATE_BODY_LIMIT_BYTES")));
const code = ts.transpileModule(statements.map(s => s.getText(source)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const { readRequestBody, sendJson, limit } = new Function("Buffer", `${code}; return { readRequestBody, sendJson, limit: MAP_STATE_BODY_LIMIT_BYTES };`)(Buffer);

function setup(maxBytes?: number) {
  const req = Object.assign(new EventEmitter(), { destroy: vi.fn() });
  const res = {
    writableEnded: false, statusCode: 0, headers: {} as Record<string, string>, body: "",
    setHeader(name: string, value: string) { this.headers[name] = value; },
    end(body: string) { this.body = body; this.writableEnded = true; },
  };
  const result = readRequestBody(req, res, maxBytes);
  return { req, res, result };
}

test("diagnostic: reader accepts a 16 MB map save body", async () => {
  expect(limit).toBe(67_108_864);
  const { req, res, result } = setup(limit);
  const body = JSON.stringify({ state: { note: "x".repeat(8_000_000) }, baseState: { note: "x".repeat(8_000_000) } });
  req.emit("data", Buffer.from(body));
  req.emit("end");
  expect(await result).toBe(body);
  expect(res.writableEnded).toBe(false);
});

test("diagnostic: over 64 MiB sends 413 JSON before end and never destroys the request", async () => {
  const { req, res, result } = setup(limit);
  const rejected = expect(result).rejects.toThrow("Request body too large.");
  const chunk = Buffer.alloc(1024 * 1024, " ");
  for (let i = 0; i < 64; i++) req.emit("data", chunk);
  expect(res.writableEnded).toBe(false);
  req.emit("data", Buffer.from(" "));
  expect(res.statusCode).toBe(413);
  expect(res.headers.Connection).toBe("close");
  expect(JSON.parse(res.body)).toEqual({ error: "Request body too large.", limitBytes: limit });
  expect(req.destroy).not.toHaveBeenCalled();
  sendJson(res, 500, { error: "Later catch" });
  expect(res.statusCode).toBe(413);
  req.emit("data", chunk);
  req.emit("end");
  await rejected;
});

test("diagnostic: unrelated reader default still rejects over 10,000,000 bytes", async () => {
  const { req, res, result } = setup();
  const rejected = expect(result).rejects.toThrow("Request body too large.");
  req.emit("data", Buffer.alloc(10_000_001));
  await rejected;
  expect(res.statusCode).toBe(413);
  expect(JSON.parse(res.body).limitBytes).toBe(10_000_000);
});
