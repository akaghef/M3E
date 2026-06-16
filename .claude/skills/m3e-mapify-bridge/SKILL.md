---
name: m3e-mapify-bridge
description: |
  Use when working on M3E <-> Mapify integration, Mapify I/O, Mapify roundtrip
  verification, Markdown/MF-H export to Mapify, XMind export retrieval from
  Mapify, or structure-preserving comparison back into M3E. Prefer this skill
  whenever the user mentions Mapify with M3E, XMind, MF-H, roundtrip, "投げて再取得",
  "構造を保つ", or Mapify teacher/oracle behavior.
---

<!-- generated from agent_instructions/skills_canonical/m3e-mapify-bridge/SKILL.md; do not edit mirror directly -->

# M3E Mapify Bridge

Use Mapify as a teacher/probe layer, not as canonical M3E storage.

Current known-good route:

```text
M3E subtree / MF-H / Markdown
-> Mapify input
-> Mapify UI export as XMind
-> recover XMind content.json
-> convert to AppState-lite / structural tree
-> strict compare against the original structure
```

Do not treat Mapify private/internal API readback as open unless it has been
verified in the current session. The previously reliable path is XMind export.

## Required Workflow

1. Resolve the M3E target precisely: `workspace`, `map`, `scope`, `node`.
2. Export only the intended subtree as MF-H or Markdown headings.
3. Send that structure to Mapify. If using MCP, keep the exact outbound text.
4. Retrieve through Mapify XMind export when possible.
5. Convert XMind `content.json` with:

```bash
python3 tools/rapid_mapify_oracle/scripts/xmind_content_to_appstate.py <content.json> --out <retrieved_appstate.json>
```

6. Compare original vs retrieved structure before claiming success.

Success means all are true:

- same node count
- same max depth
- same ordered parent-child paths
- no missing or extra node paths
- no missing or extra tree edges

If artifacts are on Windows-only paths, classify them as peer evidence unless
the files are actually synced to this host.

## Safety

- Do not extract or print Mapify cookies, OAuth tokens, API keys, or browser
  session material.
- Do not make Mapify the source of truth.
- Do not write retrieved data into an M3E map until the strict comparison result
  is known and the user asked for writeback.
- Do not create throwaway M3E maps for verification unless explicitly asked.
- Use existing import/export code and `tools/rapid_mapify_oracle/` before
  inventing new parsers.

## References

- Detailed roundtrip procedure: `references/roundtrip.md`
- Existing Mapify policy: `tools/rapid_mapify_oracle/docs/mapify_io_policy.md`
- XMind converter: `tools/rapid_mapify_oracle/scripts/xmind_content_to_appstate.py`

