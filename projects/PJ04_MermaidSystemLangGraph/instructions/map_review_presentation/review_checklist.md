---
pj_id: PJ04
package: map_review_presentation
doc: review_checklist
date: 2026-04-30
---

# Review Checklist

akaghef が map / PJv scope を巡回確認する時の観点。

## 1. Map Level

| check | OK criteria |
|---|---|
| 入口が分かる | root 直下の主要 scope が読める |
| 迷子にならない | strategy / work scope / review queue の場所が明確 |
| 色が意味を持つ | difficulty / status の色がざっくり合っている |
| 不要な test map が混ざらない | safety-* / DocID Test 系は通常 review から除外 |

## 2. PJv Factory Level

| check | OK criteria |
|---|---|
| queue が読める | ready / claimed / blocked / done が分かる |
| worker scope が分離 | PJvXX ごとに他 worker と衝突しない |
| 仕様が先にある | Assignment Spec が YAML より先にある |
| diagram が粗い | 上位 system diagram が 3-5 node に収まる |
| Data View が実体対応 | folder / file / tmp artifact と結びつく |
| Run Evidence がある | build/run 結果の要約がある |

## 3. System Diagram Level

| check | OK criteria |
|---|---|
| 上位 flow | `Load -> Build -> Generate -> Evaluate -> Write` 程度 |
| subsystem | provider call / retry / fallback が内部に隠れている |
| fallback | API失敗・bad output の行き先がある |
| output | `tmp/` など具体 artifact がある |
| trace | map 正本ではなく evidence / tmp 側にある |

## 4. Verdict Labels

| verdict | meaning |
|---|---|
| `pass` | 次へ進める |
| `revise` | worker が修正すれば進める |
| `blocked` | akaghef 判断が必要 |
| `discard` | この PJv* は今回やらない |

## 5. Minimal Comment Format

```text
verdict: pass|revise|blocked|discard
scope:
reason:
next:
```
