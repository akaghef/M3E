import { OT_NATIVE_FIXTURES } from "../fixtures/ot_native_fixtures";

/** No request is forwarded: this workshop has no live backend. */
export function installOtSafeFetch(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const method = String(init?.method || request?.method || "GET").toUpperCase();
    const url = new URL(request?.url || String(input), "http://ot-lab.invalid");
    const reply = (body: unknown, status = 200) => new Response(
      method === "HEAD" ? null : JSON.stringify(body),
      { status, headers: { "content-type": "application/json" } },
    );
    if (method !== "GET" && method !== "HEAD") {
      if (url.pathname === "/api/jserr") console.error("[OT upstream error]", init?.body || "See upstream error event");
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("OT_LAB_WRITE_ATTEMPT", {
        detail: { path: url.pathname, method },
      }));
      return reply({ ok: false, error: "OT fixture refuses live writes", code: "OT_LAB_WRITE_ATTEMPT" }, 403);
    }
    switch (url.pathname) {
      case "/api/agents": return reply({ agents: OT_NATIVE_FIXTURES.agents });
      case "/api/graph": return reply(OT_NATIVE_FIXTURES.graph);
      case "/api/custom-portraits": return reply({});
      case "/api/messages-since": return reply({ ok: true, now: 1700000010, messages: [] });
      case "/api/edge-messages": return reply({ ok: true, messages: OT_NATIVE_FIXTURES.messages });
      case "/api/agent-history": return reply({ ok: true, since_ts: 1699999900, now_ts: 1700000010, events: OT_NATIVE_FIXTURES.replay });
      case "/api/history": return reply(OT_NATIVE_FIXTURES.history);
      case "/api/deliverables": return reply(OT_NATIVE_FIXTURES.deliverables);
      case "/api/mail-watcher-health": return reply({ status: "fixture", watcher_running: false });
      default: return reply({ ok: false, error: `No fixture for ${url.pathname}`, code: "OT_LAB_UNMOCKED_READ" }, 404);
    }
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}
