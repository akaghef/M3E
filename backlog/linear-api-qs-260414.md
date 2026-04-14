# Linear API — Qn pool (pending map sync)

Route: `ROOT/SYSTEM/DEV/reviews/Linear API/Qn`
Agent: data
Date: 2026-04-14
Tentative decisions taken (attributes.tentative="yes"). Operator: please promote to map when map server is reachable.

## Q1: PUT semantics — full replace vs append?
- tentative: **full replace**. PUT writes `linearNotesByScope[scopeId] = body.text` verbatim.
- rationale: matches HTTP PUT idempotency; appending is a client-side UX concern and keeps the server stateless.
- reversal cost: low on wire format (new endpoint or extra `mode` param); medium on client integrations already deployed.

## Q2: Debounce strategy — server-side or client-side?
- tentative: **client-side only**. Server accepts every PUT; each write bumps docVersion + fires SSE.
- rationale: server coalescing would require per-scope timers and complicates SSE fan-out; client already owns keystroke cadence.
- reversal cost: low; a future server-side coalescer can be added without breaking the API.

## Q3: DELETE of missing key — 404 or 200?
- tentative: **200 idempotent** (`removed: false` when key was absent).
- rationale: DELETE is idempotent per REST conventions; 404 reserved for unknown scopeId (node missing).
- reversal cost: low.

## Q4: Empty string vs delete?
- tentative: **distinct**. PUT with `""` preserves the key (explicit empty); DELETE removes the key entirely.
- rationale: lets UI distinguish "cleared by user" from "never set".
- reversal cost: low.
