/** OT-native fixture boundary. Install before an entry registers any handler. */
export function installOtSafeFetch(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = String(init?.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return new Response(JSON.stringify({ error: "OT fixture refuses live writes", code: "OT_LAB_WRITE_ATTEMPT" }), { status: 403, headers: { "content-type": "application/json" } });
    }
    return original(input, init);
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}
