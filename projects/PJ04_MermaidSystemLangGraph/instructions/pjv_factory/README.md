---
pj_id: PJ04
package: pjv_factory
date: 2026-04-30
status: active
purpose: PJv* を複数並列で Template System Spec / system diagram / CLI run へ変換するための指示パッケージ
---

# PJv Factory Instruction Package

このパッケージは、PJv34 以外の PJv* を Claude / Codex / 他 agent が同じ手順で system 化するための作業導線である。

目的は、各 PJv* をいきなり system diagram にしないこと。先に割り当て仕様を多段階で固め、仕様書を作り、それに従って Template System Spec と M3E map 上の system diagram を作る。

## Package Files

| ファイル | 役割 |
|---|---|
| `master_instruction.md` | 次セッションの Master agent が読む総指示 |
| `worker_prompt.md` | 各 PJv* worker に渡す作業指示 |
| `assignment_spec_template.md` | PJv* ごとの割り当て仕様書テンプレ |
| `map_scope_contract.md` | M3E map 側の作業スコープ構造と並列運用ルール |
| `batch_manifest.yaml` | バッチ投入する PJv* の queue / status / ownership |

## Standard Flow

```text
0. Select PJv*
1. Draft Assignment Spec
2. Review / Freeze Spec
3. Write Template System Spec
4. Build AppState / GraphSpec
5. Create or update Map System Diagram scope
6. Run mock provider
7. Record trace / artifact / residuals
```

## Non-goals

- PJv* の内容そのものを勝手に採否判断しない
- Runtime Board / trace overlay UI はこの package では実装しない
- Python LangGraph bridge / checkpoint / streaming は触らない
- 既存 PJv34 spec を壊さない

## Done Definition

PJv* 1件の system 化は、以下を満たしたら done とする。

- `assignment_spec_template.md` 由来の仕様書が `projects/PJ04_MermaidSystemLangGraph/specs/pjvXX_*.md` にある
- Template System Spec が `projects/PJ04_MermaidSystemLangGraph/templates/pjvXX_*.yaml` にある
- `npm run template:build -- --spec ...` が build issues / warnings / validation issues 0
- `npm run template:run -- --spec ...` が mock provider で成功
- M3E map の PJ04 factory scope に PJv* の system diagram scope が作られている
- 残件が `batch_manifest.yaml` と map scope の両方に残っている
