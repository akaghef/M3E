import { spawn } from "child_process";

export type CodexProgressiveAction = "detail" | "examples" | "classify" | "related";

export interface CodexProgressiveGenerationRequest {
  action: CodexProgressiveAction;
  nodeText: string;
  nodeDetails: string;
  ancestorLabels: string[];
  existingChildLabels: string[];
  scopeAddress: string;
  selectedAddress: string;
  scopeMfH: string;
  cwd: string;
}

export interface CodexProgressiveGenerationResult {
  threadId: string;
  turnId: string;
  model: string;
  children: string[];
  rawText: string;
}

export const CODEX_PN_MODEL = process.env.M3E_CODEX_PN_MODEL || "gpt-5.3-codex-spark";

type JsonRpcMessage = {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string };
};

class JsonRpcProcess {
  private readonly child = spawn(process.env.M3E_CODEX_BIN || "codex", ["app-server", "--stdio"], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
  });
  private nextId = 1;
  private stdoutBuffer = "";
  private stderr = "";
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private readonly notifications: JsonRpcMessage[] = [];
  private readonly completedAgentMessages = new Map<string, string>();
  private closed = false;

  constructor() {
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.onStdout(chunk));
    this.child.stderr.on("data", (chunk: string) => { this.stderr += chunk; });
    this.child.on("error", (error) => this.failAll(error));
    this.child.on("exit", (code) => {
      if (!this.closed) this.failAll(new Error(`Codex App Server exited before completion (code ${code ?? "unknown"}). ${this.stderr.trim()}`));
    });
  }

  private onStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    let newline = this.stdoutBuffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (line) this.onLine(line);
      newline = this.stdoutBuffer.indexOf("\n");
    }
  }

  private onLine(line: string): void {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      return;
    }
    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message || "Codex App Server returned an error."));
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (message.method === "item/completed") {
      const params = message.params as { threadId?: unknown; turnId?: unknown; item?: { type?: unknown; text?: unknown } } | undefined;
      if (typeof params?.threadId === "string" && typeof params.turnId === "string"
        && params.item?.type === "agentMessage" && typeof params.item.text === "string") {
        this.completedAgentMessages.set(`${params.threadId}:${params.turnId}`, params.item.text);
      }
    }
    if (message.method) this.notifications.push(message);
  }

  request(method: string, params: unknown, timeoutMs = 30_000): Promise<unknown> {
    if (this.closed) return Promise.reject(new Error("Codex App Server is closed."));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex App Server timed out waiting for ${method}.`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  async waitForTurn(threadId: string, turnId: string, timeoutMs = 120_000): Promise<JsonRpcMessage> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const index = this.notifications.findIndex((message) => (
        message.method === "turn/completed"
        && typeof message.params === "object"
        && message.params !== null
        && (message.params as { threadId?: unknown }).threadId === threadId
        && ((message.params as { turn?: { id?: unknown } }).turn?.id === turnId)
      ));
      if (index >= 0) return this.notifications.splice(index, 1)[0]!;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("Codex App Server timed out waiting for generation to complete.");
  }

  agentMessage(threadId: string, turnId: string): string {
    const text = this.completedAgentMessages.get(`${threadId}:${turnId}`);
    if (!text) {
      const methods = this.notifications.map((message) => message.method).filter(Boolean).join(", ");
      const errors = this.notifications
        .filter((message) => message.method === "error")
        .map((message) => JSON.stringify(message.params))
        .join(" | ");
      throw new Error(`Codex App Server completed without an agent message. Notifications: ${methods || "none"}. ${errors}`);
    }
    return text;
  }

  close(): void {
    this.closed = true;
    this.child.kill();
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

function relationFor(action: CodexProgressiveAction): string {
  if (action === "examples") return "example_of";
  if (action === "classify") return "subtype_of";
  if (action === "related") return "related_to";
  return "detail_of";
}

export function parseCodexChildren(rawText: string, action: CodexProgressiveAction): string[] {
  const trimmed = rawText.trim();
  const jsonText = trimmed.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Codex App Server returned a non-JSON PN proposal.");
  }
  const values = Array.isArray(parsed)
    ? parsed
    : (typeof parsed === "object" && parsed !== null ? (parsed as { children?: unknown }).children : undefined);
  if (!Array.isArray(values)) throw new Error("Codex App Server PN proposal must contain a children array.");
  const seen = new Set<string>();
  const children: string[] = [];
  const expectedRelation = relationFor(action);
  for (const value of values) {
    const item = typeof value === "object" && value !== null
      ? value as { text?: unknown; relation?: unknown }
      : null;
    if (!item || item.relation !== expectedRelation) continue;
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text || text.length > 160 || seen.has(text.toLocaleLowerCase())) continue;
    seen.add(text.toLocaleLowerCase());
    children.push(text);
    if (children.length === 12) break;
  }
  if (children.length === 0) throw new Error("Codex App Server PN proposal contained no usable children.");
  return children;
}

function completionTemplate(nodeText: string): string {
  return [`# ${nodeText}`, "## ???", "## ???", "## ???", "## ???"].join("\n");
}

function promptFor(request: CodexProgressiveGenerationRequest): string {
  const actionInstruction: Record<CodexProgressiveAction, string> = {
    detail: "選択 node の説明的な詳細を追加する。分類、具体例、関連topicへ置き換えない。relation は detail_of。",
    examples: "選択 node を実例として具体化する固有または具体的なinstance/caseを追加する。特徴、定義、分類、言い換えは禁止。relation は example_of。",
    classify: "選択 node の互いに異なる子分類を追加する。具体例や特徴は追加しない。relation は subtype_of。",
    related: "選択 node と直接関連し、次に検討すべきtopicを追加する。分類や具体例にはしない。relation は related_to。",
  };
  const expectedRelation = relationFor(request.action);
  return [
    "You are the generation runtime behind M3E Progressive Navigation.",
    "Do not use tools, do not inspect files, and do not modify anything.",
    `Return exactly one JSON object and no markdown: {\"children\":[{\"text\":\"...\",\"relation\":\"${expectedRelation}\"}]}`,
    "Use Japanese. Fill all four ??? slots with concise noun-phrase node labels, each at most 60 characters.",
    "Do not repeat existing children or ancestors. Do not include explanation.",
    "The MF-H scope is the authoritative semantic context. Preserve its hierarchy and granularity.",
    "Only fill the ??? slots in the completion template. Do not rewrite the existing scope.",
    `Operation: ${actionInstruction[request.action]}`,
    `Selected node: ${request.nodeText}`,
    `Selected address: ${request.selectedAddress}`,
    `Scope address: ${request.scopeAddress}`,
    request.nodeDetails ? `Selected details: ${request.nodeDetails}` : "",
    request.ancestorLabels.length ? `Ancestors: ${request.ancestorLabels.join(" > ")}` : "",
    request.existingChildLabels.length ? `Existing children (do not repeat): ${request.existingChildLabels.join(", ")}` : "",
    `MF-H scope:\n${request.scopeMfH}`,
    `MF-H completion template:\n${completionTemplate(request.nodeText)}`,
  ].filter(Boolean).join("\n");
}

export async function generateProgressiveChildrenWithCodex(
  request: CodexProgressiveGenerationRequest,
): Promise<CodexProgressiveGenerationResult> {
  const rpc = new JsonRpcProcess();
  try {
    await rpc.request("initialize", { clientInfo: { name: "m3e-progressive-navigation", version: "1" } });
    const threadResponse = await rpc.request("thread/start", {
      cwd: request.cwd,
      model: CODEX_PN_MODEL,
      allowProviderModelFallback: false,
      approvalPolicy: "never",
      sandbox: "danger-full-access",
      baseInstructions: "You are a read-only structured proposal generator. Never use tools. Return only the exact format requested by the user.",
    }) as { thread?: { id?: unknown }; model?: unknown };
    const threadId = typeof threadResponse.thread?.id === "string" ? threadResponse.thread.id : "";
    if (!threadId) throw new Error("Codex App Server did not return a thread id.");
    const model = typeof threadResponse.model === "string" ? threadResponse.model : "";
    if (model !== CODEX_PN_MODEL) {
      throw new Error(`Codex App Server selected unexpected model: ${model || "unknown"}. Expected ${CODEX_PN_MODEL}.`);
    }
    const turnResponse = await rpc.request("turn/start", {
      threadId,
      model: CODEX_PN_MODEL,
      approvalPolicy: "never",
      sandboxPolicy: { type: "readOnly", networkAccess: false },
      input: [{ type: "text", text: promptFor(request) }],
    }) as { turn?: { id?: unknown } };
    const turnId = typeof turnResponse.turn?.id === "string" ? turnResponse.turn.id : "";
    if (!turnId) throw new Error("Codex App Server did not return a turn id.");
    const completed = await rpc.waitForTurn(threadId, turnId);
    const completedTurn = (completed.params as { turn?: { status?: unknown; error?: { message?: unknown } } } | undefined)?.turn;
    if (completedTurn?.status === "failed") {
      throw new Error(typeof completedTurn.error?.message === "string"
        ? completedTurn.error.message
        : "Codex App Server PN turn failed.");
    }
    const rawText = rpc.agentMessage(threadId, turnId);
    return { threadId, turnId, model, rawText, children: parseCodexChildren(rawText, request.action) };
  } finally {
    rpc.close();
  }
}
