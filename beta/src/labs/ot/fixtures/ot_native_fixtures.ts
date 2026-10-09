const agents = [
    { name: "Ada Lovelace", category: "agent", running: true, attached: true, cmd: "codex", live: "agentstack-demo", model: "fixture-model", provider: "openai", ctx_used: 28, act_state: "work", task: "Trace the signal path", deliv: 0 },
    { name: "Alan Turing", category: "agent", running: true, attached: true, cmd: "claude", live: "agentstack-demo", model: "fixture-model", provider: "anthropic", ctx_used: 41, act_state: "wait", task: "Inspect the edge thread", deliv: 1 },
    { name: "Marie Curie", category: "gone", running: false, attached: false, cmd: "zsh", live: "", model: "fixture-model", provider: "openai", ctx_used: null, act_state: "", task: "Finished fixture task", deliv: 1 },
  ] as const;

export const OT_NATIVE_FIXTURES = {
  agents,
  history: { ok: true, total: 2, shown: 2, file: "fixture-transcript.jsonl", events: [
    { role: "user", kind: "text", ts: "2023-11-14T22:13:20Z", text: "Trace the signal path" },
    { role: "assistant", kind: "text", ts: "2023-11-14T22:13:22Z", text: "Signal path traced; preparing the review." },
  ] },
  deliverables: { vault: "", items: [{ title: "Signal trace report", rel: "LOG_signal.md", mtime: 1700000003 }] },
  messages: [
    { id: 1, ts: 1700000001, sender: "Ada Lovelace", recipient: "Alan Turing", subject: "Signal trace", excerpt: "The comet reached the edge.", importance: "high", kind: "to", thread_id: "thread-ot-1" },
    { id: 2, ts: 1700000002, sender: "Alan Turing", recipient: "Ada Lovelace", subject: "Re: Signal trace", excerpt: "I expanded the message.", importance: "normal", kind: "to", thread_id: "thread-ot-1" },
  ],
  graph: {
    nodes: agents,
    shown: agents.length, total: agents.length,
    edges: [{ source: "Ada Lovelace", target: "Alan Turing", count: 2, last_ts: 1700000002, kind: "to" }],
    spawn: [{ source: "Ada Lovelace", target: "Alan Turing", type: "spawn" }],
  },
  replay: [
    { kind: "spawn", source: "Ada Lovelace", target: "Alan Turing", ts: 1700000000 },
    { kind: "mail_recv", sender: "Alan Turing", recipient: "Ada Lovelace", ts: 1700000002 },
    { kind: "exit", name: "Marie Curie", ts: 1700000003 },
  ],
  spawnPayload: {
    name: "Ada Lovelace", provider: "openai", model: "fixture-model", directory: "/tmp/ot-seam-fixture", task: "Fixture-only spawn", parent: "Alan Turing", role: "researcher", group: "ot-fixture", worktree: false,
  },
} as const;
