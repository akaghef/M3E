# X Tech Radar — Codex Task Brief

*2026-04-14 — handoff to codex once akaghef resolves Q1-Q7*
*Design: [dev-docs/design/x_tech_radar.md](../dev-docs/design/x_tech_radar.md)*
*Base branch: `dev-beta` | Work branch suggestion: `dev-data` (pipeline lives server-side)*

## 1. Current status

| Phase | Spec | Code | Merged | PR |
|---|---|---|---|---|
| P1 Manual trigger — bookmarks → map | ✅ design | ❌ | ❌ | none |
| P2 Cron + likes + notifications      | ✅ design | ❌ | ❌ | none |
| P3 Promote / dismiss / refresh       | ✅ design | ❌ | ❌ | none |

**Blockers before codex starts**:
- akaghef must resolve Q1-Q7 on map (`ROOT/SYSTEM/DEV/reviews/X Tech Radar/`) with `attributes.selected="yes"`.
- akaghef must provide X API credentials via `.env.local` (keys listed in §8 of design doc). No keys committed.
- akaghef must confirm PPU billing is active in X Developer Console (or set Basic tier).

---

## 2. Files to add (P1)

```
beta/src/node/tech_radar/
├── schema.sql                 -- SQLite tables: raw_posts, candidates, research_cache
├── ingest_bookmark_mcp.ts     -- reads bookmark-mcp SQLite, writes into tech_radar.db
├── extract.ts                 -- heuristics + Haiku fallback
├── research.ts                -- GitHub/npm/arxiv enrichment with ETag cache
├── evaluate.ts                -- Sonnet call with rubric + M3E arch context
├── write_to_map.ts            -- PATCH calls to map REST API
└── cli.ts                     -- `npm run tech-radar:sync` entry

beta/src/node/tech_radar/__fixtures__/
├── sample_tweets.json
├── sample_github_response.json
└── ...

beta/tests/unit/tech_radar/
├── extract.test.ts            -- heuristic coverage + Claude stub
├── research.test.ts           -- GitHub fixture-based
├── evaluate.test.ts           -- rubric cases (adopt/trial/assess/hold)
└── write_to_map.test.ts       -- mock map API

beta/package.json               -- add "tech-radar:sync" script
beta/.env.local.example         -- document required env vars (commit this)
beta/.gitignore                 -- ensure .env.local ignored
```

No changes to `beta/src/browser/` for P1. No UI.

---

## 3. Manual test workflow (P1 smoke)

Prereq: akaghef has run `chrislee973/twitter-bookmark-mcp sync` at least once; SQLite path known.

### Gate A — Ingest
1. Set `BOOKMARK_MCP_DB=/path/to/bookmarks.sqlite` in `.env.local`.
2. `cd beta && npm run tech-radar:sync -- --stage=ingest`.
3. **Expect**: `~/.m3e/tech_radar.db` created, `raw_posts` table populated; no duplicates on second run.

### Gate B — Extract
1. `npm run tech-radar:sync -- --stage=extract`.
2. **Expect**: `candidates` rows for posts with GitHub/npm/arxiv URLs; no Claude call logged for posts that hit heuristics; Claude call logged for posts that don't.
3. **Fail**: silent drop of posts where extraction returns `[]` without logging why.

### Gate C — Research
1. `npm run tech-radar:sync -- --stage=research`.
2. **Expect**: candidates enriched with stars / license / language; second run uses ETag cache (no new HTTP).
3. **Fail**: unauthenticated GitHub 403 rate-limit with no fallback message.

### Gate D — Evaluate
1. `npm run tech-radar:sync -- --stage=evaluate`.
2. **Expect**: each candidate has a rating in {adopt, trial, assess, hold}, with rationale. Rubric violations (GPL → not hold) fail the gate.
3. **Fail**: Claude returns malformed JSON and pipeline crashes instead of marking row `eval_error`.

### Gate E — Write to map
1. Start beta viewer (`npm run start`).
2. `npm run tech-radar:sync -- --stage=write`.
3. **Expect**: `ROOT/SYSTEM/DEV/Tech Radar/{adopt,trial,assess,hold}/<toolname>` nodes appear; re-running `write` stage is idempotent (no duplicate nodes).
4. **Fail**: duplicate nodes on re-run; race with other map edits corrupts state.

### Gate F — Full run
1. `npm run tech-radar:sync` (no flags = all stages).
2. **Expect**: end-to-end run completes on 30-bookmark sample in <60s; cost budget from logs <$0.10.

### Gate G — Security smoke
1. Grep committed files for API keys → must be empty.
2. Try `.env.local` missing → CLI exits with helpful message, does not fall back to any default key.
3. Confirm `~/.m3e/tech_radar.db` path is outside repo working tree.

---

## 4. Known gaps / pooled Qs

- **Q1** MCP sidecar vs direct X API for P1 — tentative: **bookmark-mcp sidecar**.
- **Q2** Poll interval in P2 — tentative: **6h while app open**.
- **Q3** Auto-notify threshold — tentative: **rating >= trial**.
- **Q4** Storage source-of-truth — tentative: **map primary, SQLite cache**.
- **Q5** Likes OR bookmarks OR both for P1 — tentative: **bookmarks only**.
- **Q6** Models — tentative: **haiku-4-6 extract, sonnet-4-6 evaluate**.
- **Q7** Tools already in M3E — tentative: **write with `rating=assess` + `overlap_with_existing`**.

Codex: do **not** guess these; wait for `selected="yes"` on map.

---

## 5. Next actions

1. **akaghef**: resolve Q1-Q7 on beta map.
2. **akaghef**: provision X API credentials, pick billing tier.
3. **Codex**: implement P1 (files listed §2), run Gates A-G, open PR `dev-data → dev-beta` titled `feat(tech-radar): X bookmark → map pipeline (P1)`.
4. **Akaghef**: review PR, confirm rubric on a real 30-bookmark sample.
5. **Codex**: P2 as separate PR once P1 lands.

---

## 6. Reference

- Design: [dev-docs/design/x_tech_radar.md](../dev-docs/design/x_tech_radar.md)
- Related backlog: [backlog/obsidian-integration-manual-test.md](obsidian-integration-manual-test.md) — structural template this brief mirrors.
- External:
  - X API pricing (Feb 2026 PPU): https://docs.x.com/x-api/getting-started/pricing
  - Bookmarks endpoint: https://docs.x.com/x-api/users/get-bookmarks
  - Bookmark MCP sidecar: https://github.com/chrislee973/twitter-bookmark-mcp
  - MCP registry: https://registry.modelcontextprotocol.io/
