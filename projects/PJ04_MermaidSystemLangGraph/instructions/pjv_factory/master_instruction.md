---
pj_id: PJ04
package: pjv_factory
role: Master
date: 2026-04-30
---

# Master Instruction — PJv Factory

あなたは PJ04 の Master agent として、複数の PJv* を **Template System Spec + M3E System Diagram + CLI run** に変換するバッチを管理する。

## Mission

PJv34 で成立した Template-first loop を、PJv34 専用ではなく複数 PJv* に拡張する。

各 PJv* について、次の順で成果物を作る。

1. 割り当て仕様書
2. system 仕様書
3. Template System Spec YAML
4. M3E map 上の system diagram scope
5. CLI build/run 結果
6. 残件と次アクション

## Required Context

最初に読む:

| 目的 | ファイル |
|---|---|
| package overview | `projects/PJ04_MermaidSystemLangGraph/instructions/pjv_factory/README.md` |
| batch state | `projects/PJ04_MermaidSystemLangGraph/instructions/pjv_factory/batch_manifest.yaml` |
| worker prompt | `projects/PJ04_MermaidSystemLangGraph/instructions/pjv_factory/worker_prompt.md` |
| map contract | `projects/PJ04_MermaidSystemLangGraph/instructions/pjv_factory/map_scope_contract.md` |
| template catalog | `projects/PJ04_MermaidSystemLangGraph/docs/system_block_templates.md` |
| PJv34 reference | `projects/PJ04_MermaidSystemLangGraph/templates/pjv34_weekly_review.yaml` |

## Batch Procedure

### 1. Claim queue

`batch_manifest.yaml` の `items` から `status: ready` の PJv* を選ぶ。
並列化する場合、1 worker = 1 PJv* を原則にする。

同時に触るファイル範囲を分ける:

| worker | 書く場所 |
|---|---|
| PJvXX worker | `specs/pjvXX_*.md`, `templates/pjvXX_*.yaml`, map の `PJvXX` scope |
| Master | `batch_manifest.yaml`, daily, tasks, map の queue/status |

### 2. Require staged specification

worker にいきなり YAML を書かせない。

必ず次を作らせる:

1. Assignment Spec
2. System Contract Summary
3. Data View Summary
4. Failure / fallback policy
5. Candidate System Diagram

この段階で `status: spec_review` にする。

### 3. Freeze spec

Master は仕様書を確認し、以下を満たしたら `status: spec_frozen` にする。

- input / output / reads / writes が明確
- system node の粒度が粗すぎない / 細かすぎない
- subsystem 化する箇所が明確
- fallback / Qn / retry が必要な場所だけにある
- data artifact が `tmp/` または local resource と対応している

### 4. Build Template System Spec

worker に YAML を作らせる。

禁止:

- template catalog にない key を勝手に発明する
- secret / API key を書く
- PJv34 固有 callable_ref を流用する

許可:

- `callable_ref` は `pjvXX.<scope>.<function>` 形式の placeholder として置く
- mock provider 前提の `llm.generate_doc.subsystem` を使う

### 5. Build / Run

Master または worker は `beta/` で実行する。

```powershell
cd C:\Users\Akaghef\dev\M3E\beta
npm run template:build -- --spec projects/PJ04_MermaidSystemLangGraph/templates/pjvXX_name.yaml --out tmp/pjvXX-template-system.json
npm run template:run -- --spec projects/PJ04_MermaidSystemLangGraph/templates/pjvXX_name.yaml --out tmp/pjvXX-template-run.md
```

成功条件:

- build issues 0
- warnings 0
- validation issues 0
- run が mock provider で完了
- trace node ids が Control Graph node ids と対応

### 6. Map write

M3E map `開発` の `strategy / PJ04 PJv Factory` 配下に、PJv* ごとの system diagram scope を作る。
構造は `map_scope_contract.md` に従う。

Map は並列 worker が同じ親に同時書き込みしないよう、Master が queue/status 親を管理する。
worker は割り当てられた `PJvXX` scope の中だけを更新する。

### 7. Handoff

各 PJv* の完了時、worker から次を受け取る。

- changed files
- build/run command output summary
- map path
- residual risks
- next concrete task

Master は `batch_manifest.yaml` と daily に反映する。

## Acceptance For Next Session

次セッションの実行開始前に、Master は以下を確認する。

- `strategy / PJ04 PJv Factory` が map に存在する
- `batch_manifest.yaml` に少なくとも 3 件の placeholder item がある
- `worker_prompt.md` だけで worker が PJv* 1件を処理できる
- PJv34 reference は読み取り専用として扱われる

## Stop Conditions

次の場合は作業を止め、reviews/Qn に判断待ちを出す。

- PJv* の入力 source が存在しない
- system の output が定義不能
- template catalog に必要 block がなく、既存 block の組み合わせで表現できない
- map 書き込み競合が起きた
- API key / secret を要求された
