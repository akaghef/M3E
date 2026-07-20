# Orchestration Map Pilot Result 260719

## Scope

- 対象: `docs/tasks/handoff_orchestration_map_pilot_260719.md` §6 acceptance の pilot CLI surface
- 作業 worktree: `/Users/nisimoriyuuya/dev/M3E-worktrees/orchestration-map-pilot`
- branch: `codex/orchestration-map-pilot`
- live 実行境界: sandbox から `127.0.0.1:7687` への TCP 接続が `EPERM` で拒否されたため、Neo4j live import / query / recovery drill は未実行
- secret 境界: credentials env の内容は成果物・log・PR へ複製しない

## Implemented CLI

All scripts are under `scripts/pilot/` and emit one JSON object per run.

| Script | Purpose |
|---|---|
| `scripts/pilot/import` | `docs/semantic/m3e-design.source.json` を `source-materialized` record として冪等 import |
| `scripts/pilot/orchestration-seed` | S16 系実案件の `M3E-owned accepted` Goal / Task / Agent / Gate / status と Proposal pattern を投入 |
| `scripts/pilot/lint` | unique / 必須 property / record role 混同 / isolated Proposal / relation 必須 property を検査 |
| `scripts/pilot/dump` | pilot subgraph の logical dump summary を JSON 出力 |
| `scripts/pilot/logical-export` | pilot subgraph の portable snapshot JSON を出力 |
| `scripts/pilot/restore-drill` | portable snapshot から pilot subgraph を削除・復元し lint を再実行 |
| `scripts/pilot/query` | Demand Gate query `Q1`〜`Q3` を実行 |

## Dry-Run Evidence

Sandbox TCP smoke test:

```json
{"ok":false,"host":"127.0.0.1","port":7687,"layer":"tcp","message":"connect EPERM 127.0.0.1:7687 - Local (0.0.0.0:0)"}
```

Syntax check:

```bash
for f in scripts/pilot/common.cjs scripts/pilot/import scripts/pilot/orchestration-seed scripts/pilot/lint scripts/pilot/dump scripts/pilot/logical-export scripts/pilot/restore-drill scripts/pilot/query; do node --check "$f" || exit 1; done
```

Result: exit code 0.

Semantic source import check:

```json
{"ok":true,"mode":"check","source":"/Users/nisimoriyuuya/dev/M3E-worktrees/orchestration-map-pilot/docs/semantic/m3e-design.source.json","issues":[]}
```

Query check:

```json
{"ok":true,"mode":"check","queries":["Q1","Q2","Q3"],"unknown":[]}
```

Lint check:

```json
{"ok":true,"mode":"check","checks":["unique id","required properties","record role boundaries","isolated Proposal","relationship properties"]}
```

Restore-drill check:

```json
{"ok":true,"mode":"check","from":"live export","snapshotSchema":"not-read"}
```

## Director Live Run

Run from repo root after installing dependencies in `beta/`.

```bash
cd /Users/nisimoriyuuya/dev/M3E-worktrees/orchestration-map-pilot/beta
npm install
cd ..
```

Then execute the pilot sequence. Do not print the credentials file.

```bash
export M3E_NEO4J_ENV=/Users/nisimoriyuuya/dev/M3E-private/pilot/neo4j-credentials.env

scripts/pilot/import --env "$M3E_NEO4J_ENV"
scripts/pilot/orchestration-seed --env "$M3E_NEO4J_ENV"
scripts/pilot/lint --env "$M3E_NEO4J_ENV"
scripts/pilot/query all --env "$M3E_NEO4J_ENV"

mkdir -p tmp/pilot
scripts/pilot/dump --env "$M3E_NEO4J_ENV" --out tmp/pilot/orchestration-map-pilot.dump.json
scripts/pilot/logical-export --env "$M3E_NEO4J_ENV" --out tmp/pilot/orchestration-map-pilot.snapshot.json
scripts/pilot/restore-drill --env "$M3E_NEO4J_ENV" --from tmp/pilot/orchestration-map-pilot.snapshot.json --out tmp/pilot/orchestration-map-pilot.restore.json
scripts/pilot/lint --env "$M3E_NEO4J_ENV"
```

Expected gates:

- `import`: returns `ok:true`, source id `src:m3e-design-corpus`, and counts for imported entities/assertions
- `orchestration-seed`: returns `ok:true` with S16 Goal / Task / Agent / Gate / Proposal counts
- `lint`: returns `ok:true` and `violations:[]`
- `query all`: returns `Q1`, `Q2`, and `Q3` rows including provenance and revision fields
- `restore-drill`: returns `ok:true`, matching before/after snapshot hash, and `lintOk:true`

## Residual Risk

- `neo4j-driver` was added to `beta/package.json`, but this sandbox could not refresh `beta/package-lock.json` because registry access failed with `ENOTFOUND registry.npmjs.org`. Director must run `npm install` in `beta/` before live execution.
- `dump` is a logical pilot-subgraph dump, not a physical Neo4j engine dump. Recovery Gate evidence is based on `logical-export` plus `restore-drill`, matching ADR_008's portable snapshot requirement.

---

## Live Run Evidence (Director, 2026-07-19)

| Step | Result |
|---|---|
| import | ok=true, src:m3e-design-corpus @ 5f04aac, 50 entities / 47 assertions, mode=live |
| orchestration-seed | ok=true, 13 nodes / 20 relationships (Goal/Task/Agent/Gate/Proposal) |
| lint (seed後) | ok=true, violations=[] (6 checks) |
| query Q1〜Q3 | ok=true。全行に provenance + revision。Q3 は M3E-owned proposal ↔ source-materialized evidence の role 横断を実証 |
| dump / logical-export | 63 nodes / 67 relationships, hash 692821a4f3df335723525f8e7566c07678ef07e1e0dba0d199c9c4878198d6b0 |
| **restore-drill** | **beforeHash == afterHash（上記と一致）、63/67 復元、復元後 lint 違反 0 — Recovery Gate 通過** |

環境: Neo4j CE (Docker `m3e-neo4j-pilot`, 127.0.0.1 限定, 認証必須, named volume)。credentials は `M3E-private/pilot/`（repo 外）。

未消化: MCP 登録は手順書のみ（対話セッションでの `claude mcp add` が必要）。lint の故意違反注入テストは未実施。
