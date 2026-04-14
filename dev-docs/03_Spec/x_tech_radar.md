# X Tech Radar — Design Doc

*2026-04-14 — design only, no implementation*
*Branch: `dev-team` | Target map: `akaghef-beta` (port 4173)*

## 1. Purpose

Turn akaghef's passive X (Twitter) reactions (likes, bookmarks) into a
continuously-updated **Tech Radar** of tools/tech that might slot into M3E.
Humans curate by reacting; pipeline does extraction, research, and fit
evaluation; output lands as map nodes under
`ROOT/SYSTEM/DEV/Tech Radar/<toolname>`.

The pipeline is **read-only toward X** and **write-only toward the map**.
No auto-posting to X, no auto-install of any tool.

---

## 2. Pipeline stages

```
[X reactions]
   | (stage 1: ingest)
   v
[raw post records]   -- dedup by tweet id
   | (stage 2: extract)
   v
[tool candidates]    -- {name, url, source_tweet}
   | (stage 3: research)
   v
[enriched candidates] -- + {repo stars, license, lang, last commit, docs url}
   | (stage 4: evaluate)
   v
[rated candidates]    -- + {rating, rationale, overlap, effort}
   | (stage 5: write)
   v
[map nodes under ROOT/SYSTEM/DEV/Tech Radar/<toolname>]
```

Each stage is independently restartable; intermediate state persists in a
local SQLite (`~/.m3e/tech_radar.db`) so re-runs don't re-spend API calls.

### Stage responsibilities

| Stage | Input | Output | Cost driver |
|---|---|---|---|
| 1 ingest | X API credentials | rows in `raw_posts` | X API quota |
| 2 extract | `raw_posts` where `extracted_at IS NULL` | rows in `candidates` | Claude tokens |
| 3 research | `candidates` where `researched_at IS NULL` | rows in `candidates` enriched | GitHub API (free), Claude tokens |
| 4 evaluate | enriched candidates | `candidates.rating` | Claude tokens (includes M3E arch context) |
| 5 write | rated candidates | PATCH ops to map | local only |

---

## 3. Ingestion: MCP vs direct API

### 3.1 MCP availability — research outcome

There is **no official Anthropic-maintained X MCP server**. The MCP
registry at `registry.modelcontextprotocol.io` does not ship one. However
several community MCP servers exist:

| Project | Covers likes? | Covers bookmarks? | Auth | Notes |
|---|---|---|---|---|
| `chrislee973/twitter-bookmark-mcp` | no | **yes** (SQLite dump) | OAuth 2.0 PKCE | Focused; maintains local DB; good fit for P1 |
| `rafaljanicki/x-twitter-mcp-server` | yes | yes | X API v2 | Most complete; requires paid API tier |
| `DataWhisker/x-mcp-server` | yes (via likes endpoint) | yes | X API v2 | Similar surface to above |
| `Infatoshi/x-mcp` | yes | yes | X API v2 | Includes write ops (we don't need) |
| `Xquik-dev/x-twitter-scraper` | partial | partial | Custom REST ($0.00015/call) | Third-party; ToS risk |

All MCP options reduce to **one of two substrates**:
1. Official X API v2 (OAuth 2.0 PKCE) — same quota cost whether hit via MCP or directly.
2. Scraping (Xquik / fragile) — cheaper, higher ToS risk.

**Tentative decision (pool as Qn)**:
- **P1**: use `chrislee973/twitter-bookmark-mcp` as an out-of-process ingest
  helper. akaghef runs `mcp-twitter-bookmarks sync` on demand, which fills a
  local SQLite. Our pipeline reads that SQLite. **Zero additional M3E code
  needed to talk to X**, and akaghef owns the API key.
- **P2+**: if likes coverage becomes important, switch to direct X API v2 via
  OAuth 2.0 PKCE inside `beta/src/node/tech_radar/ingest.ts`. We don't adopt
  a monolithic X MCP because we only need 1-2 endpoints and the cost of
  running a sidecar process exceeds the benefit.

### 3.2 X API cost sketch (direct, for P2)

As of Feb 2026, default pricing is **pay-per-use**: $0.005 per post read,
dedup'd within 24h UTC. Monthly cap 2M reads on PPU (above = Enterprise).

- Bookmarks endpoint: `GET /2/users/:id/bookmarks`
  - 180 req / 15min user-rate-limited.
  - ~100 tweets/page.
- Likes endpoint: `GET /2/users/:id/liked_tweets`
  - 75 req / 15min.
  - ~100 tweets/page.

Assume akaghef reacts to 30 posts/day → 900/month → $4.50/month at PPU
prices. Negligible. Free tier no longer covers likes writes (we only read,
so this is OK) but **read endpoints require Basic ($200/mo) or PPU**.
Tentative: **PPU**, because the cap is more than we'll ever hit.

### 3.3 Scraping — not adopted

Flagging for completeness: scraping via `nitter`-style mirrors or headless
browser is cheaper but violates X ToS and breaks on layout changes. We
explicitly **do not** take this path; note it so akaghef knows it was
considered.

---

## 4. Entity extraction (stage 2)

Input: a tweet's `text` + `entities.urls` + `entities.hashtags` + expanded
URLs of quoted tweets. Output: zero or more `{name, canonical_url, kind}`.

### 4.1 Heuristics first (free)

Pre-filter with cheap regex before spending Claude tokens:
- `github\.com/[\w.-]+/[\w.-]+` → GitHub repo (kind=`repo`)
- `npmjs\.com/package/[\w@/.-]+` → npm pkg (kind=`npm`)
- `huggingface\.co/...` → HF model (kind=`model`)
- `arxiv\.org/abs/\d+` → paper (kind=`paper`)
- `pypi\.org/project/...` → pypi (kind=`pypi`)
- Capitalised hashtag matching known-tool-lexicon → (kind=`keyword`)

If any heuristic fires, we skip Claude for that post (saves ~100% of
extraction calls on the common case).

### 4.2 Claude fallback

For posts with no hit:
- Prompt: "Below is a tweet. Extract any software tool, library, product,
  architecture, or paper referenced. Return JSON array of
  `{name, url_if_any, kind, one_line_why_relevant}` or `[]`."
- Model: `claude-haiku-4-6` (cheap tier) — extraction is classification,
  not reasoning.
- Budget: ~500 in + 200 out tokens per post. At 30 reactions/day where ~30%
  miss heuristics = 10 Claude calls/day ≈ $0.03/day.

### 4.3 Dedup & canonicalisation

Canonical URL = lower-cased host + path; strip tracking params
(`utm_*`, `?s=`, trailing slash). Repo dedup key = `github.com/org/repo`
irrespective of branch/path/anchor.

Candidate key = canonical URL OR lowercased name if URL absent.

---

## 5. Research (stage 3)

For each candidate with a URL:

1. **GitHub repo** (most common): hit unauthenticated `api.github.com/repos/:org/:repo`:
   - `stargazers_count`, `license.spdx_id`, `language`, `pushed_at`,
     `size`, `topics`, `subscribers_count`.
   - README: fetch `raw.githubusercontent.com/.../main/README.md` (fallback `master`).
   - Rate limit unauth: 60/hour → use a GitHub PAT from env
     `GITHUB_TOKEN` (5000/hour). No token committed.
2. **npm**: `registry.npmjs.org/<pkg>` for version + deps count.
3. **arxiv**: fetch abstract from `export.arxiv.org/api/query?id_list=...`.
4. **Generic URL**: skip deep research; rely on tweet context only.

Cache all responses in SQLite `research_cache` keyed by URL + ETag; 24h
TTL default.

---

## 6. Evaluate (stage 4) — integration-fit rubric

Single Claude call per candidate. Context includes:
- M3E architecture summary (static block, ~2k tokens):
  "Electron app. Freeplane-based map viewer. React+TS browser, Node server
  on 4173. SSE for collab. SQLite optional. MIT-compatible deps only."
- The enriched candidate.

Output JSON schema:
```json
{
  "rating": "adopt" | "trial" | "assess" | "hold",
  "rationale": "2-4 sentences",
  "integration_point": "e.g. beta/src/node/... or 'new module'",
  "effort_estimate": "S | M | L | XL",
  "license_ok": true | false,
  "overlap_with_existing": "optional string pointing at existing M3E code",
  "risk_flags": ["string"]
}
```

Rubric (prompt-embedded):
- **adopt**: fills a known gap in M3E backlog; MIT/Apache/BSD; mature (≥500 stars OR paper cited ≥10x); effort ≤M.
- **trial**: promising but needs spike; or license is weak copyleft (LGPL).
- **assess**: interesting, no clear slot in current arch; park for later.
- **hold**: incompatible license (GPL/AGPL/commercial), dead repo (>18mo no commit), or overlaps existing M3E module with no advantage.

### Auto-notify threshold (tentative; pool as Qn)

- `rating >= "trial"` → ALSO send `SendMessage(to: "manage")` notification.
- `rating == "assess"` → silently write to radar; akaghef browses on demand.
- `rating == "hold"` → write with `collapsed=true` so it doesn't clutter.

---

## 7. Map layout

```
ROOT
└── SYSTEM
    └── DEV
        ├── Tech Radar/
        │   ├── (attributes: source="x-reactions", last_sync="2026-04-14T12:00Z")
        │   ├── adopt/        (collapsed=false)
        │   │   └── <tool>/
        │   ├── trial/
        │   │   └── <tool>/
        │   ├── assess/       (collapsed=true by default)
        │   │   └── <tool>/
        │   └── hold/         (collapsed=true)
        │       └── <tool>/
        └── reviews/
            └── X Tech Radar/
                └── Q1..Qn    (decision-pool nodes)
```

Each `<tool>` node:
- `text`: tool name
- `link`: canonical URL (repo / homepage)
- `details`: one-paragraph summary
- `note`: markdown with { source tweet url, rating, rationale, license, stars, effort, integration_point }
- `attributes`:
  - `rating`: adopt/trial/assess/hold
  - `source_post`: tweet URL
  - `source_kind`: bookmark|like
  - `license`: SPDX ID
  - `radar_added`: ISO8601
  - `radar_refreshed`: ISO8601

### Sample entries (mock, for shape)

**adopt** — `tinybase`
- link: `https://github.com/tinyplex/tinybase`
- details: Reactive local-first SQL/KV store for the browser. Slots into our
  AppState as a persistence backing for Cloud Sync diffs.
- attributes: rating=adopt, license=MIT, source_post=..., effort=M, integration_point=`beta/src/browser/app_state.ts`

**trial** — `marimo`
- link: `https://github.com/marimo-team/marimo`
- details: Reactive Python notebook. Possible backend for M3E "computation
  node" type. Needs spike: embedding vs subprocess.
- attributes: rating=trial, license=Apache-2.0, effort=L

**assess** — `yjs`
- link: `https://github.com/yjs/yjs`
- details: CRDT library. Overlaps with our current SSE-based collab. Worth
  reviewing when we tackle offline-multi-user.
- attributes: rating=assess, license=MIT, overlap_with_existing=`beta/src/node/collab.ts`

---

## 8. Security

- **X credentials**: stored only in env vars (`X_API_KEY`, `X_API_SECRET`,
  `X_BEARER_TOKEN`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`). `.env.local` is
  git-ignored. We document `.env.local.example` but never ship real values.
- **GITHUB_TOKEN**: optional, env only. No token = 60/hr public fallback.
- **Anthropic API key**: re-uses existing M3E `ANTHROPIC_API_KEY` env.
- **Local SQLite** contains tweet IDs + URLs + summaries. Per privacy
  policy: contains no secrets, but user content. Path defaults inside the
  user's profile dir (`~/.m3e/tech_radar.db`), not inside the repo.
- **No outbound writes to X** ever (enforced by not requesting write scopes).

---

## 9. Phased rollout

### P1 — manual trigger, bookmarks only
- `chrislee973/twitter-bookmark-mcp` (sidecar) fills local SQLite.
- M3E CLI command: `npm run tech-radar:sync` runs stages 2-5 once.
- No scheduler. No likes. No notifications. Just writes to map.
- Shippable in ~3 days of codex work.

### P2 — cron + likes
- Add direct X API v2 ingest for likes (`GET /2/users/:id/liked_tweets`).
- Wire scheduler (reuse electron app lifecycle; poll every 6h while running).
- Add `SendMessage(to: "manage")` notification for `rating >= trial`.
- Tentative poll interval: **every 6 hours while app is open** (pool as Qn).

### P3 — bidirectional / curation
- "Promote to backlog" action on a radar node → creates a `backlog/*.md`
  task brief for codex.
- "Dismiss from radar" → moves node to `hold/` with user override.
- Radar refresh: re-run research on candidates older than 30 days.

---

## 10. Dependencies on other M3E subsystems

| Subsystem | How we use it | Owner |
|---|---|---|
| beta server (Node) | host the pipeline CLI + cron | team |
| map REST API | POST patches to add/update radar nodes | data |
| SSE | broadcast "radar updated" to open viewers (optional P2) | team |
| SendMessage infra | notify manager when `rating >= trial` | manage |

No browser UI changes in P1.

---

## 11. Open questions (pooled as Qn on map)

See `ROOT/SYSTEM/DEV/reviews/X Tech Radar/` nodes. Tentatives repeated here
for in-doc reference:

- **Q1** MCP vs direct API for P1? — tentative: **bookmark-mcp sidecar**.
- **Q2** Poll interval once automated? — tentative: **manual for P1, 6h for P2**.
- **Q3** Auto-notify threshold? — tentative: **rating >= trial notifies; assess/hold silent**.
- **Q4** Source-of-truth storage? — tentative: **map nodes primary; SQLite is cache/intermediate**.
- **Q5** Likes OR bookmarks OR both for P1? — tentative: **bookmarks only** (likes is noisier, tends to include non-tech).
- **Q6** Model for extraction + evaluation? — tentative: **haiku-4-6 for extract, sonnet-4-6 for evaluate**.
- **Q7** What happens when a tool is already in M3E? — tentative: **still write, with `rating=assess` and `overlap_with_existing` pointing at the existing module**.

---

## 12. Out of scope (this doc)

- Posting to X.
- Analytics on akaghef's own posts.
- Sentiment analysis of reactions.
- Multi-user (radar is single-user for now).
- Rewriting M3E arch based on radar findings (radar only surfaces; humans decide).
