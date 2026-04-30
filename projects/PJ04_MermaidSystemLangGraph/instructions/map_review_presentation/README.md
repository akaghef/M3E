---
pj_id: PJ04
package: map_review_presentation
date: 2026-04-30
status: active
purpose: akaghef が全 map / PJv work scope を巡回確認するための Presentation Review 作業環境
---

# Map Review Presentation Package

この package は、PJv43 **Slideshow Mode** の考え方を PJ04 の確認導線に転用する。

目的は、M3E の全 map と PJ04 PJv Factory の各 work scope を、akaghef が迷わず順番に見て回れる状態にすること。
現時点では viewer UI の Presentation Mode 実装そのものではなく、**review queue / review route / evidence / verdict** を整える。

## Source Ideas

| source | meaning |
|---|---|
| `backlog/pj-vision-100.md` #43 | Slideshow Mode — マップ通しで読む |
| `backlog/pj-vision-100.md` #31 | スライド生成 — マップからプレゼン展開 |
| `idea/30_ux/slideshow/` | Guided Tour / Presentation Mode の既存ブレスト |

## Review Target

```text
M3E maps
  -> 開発
  -> 研究
  -> PJ02 Runtime
  -> PFR Blueprint
  -> Mini Project Blueprint
  -> other non-safety maps

PJ04 PJv Factory scopes
  -> Master Queue
  -> Work Scopes/PJv35
  -> Work Scopes/PJv36
  -> Work Scopes/PJv37
  -> Work Scopes/PJv43
```

## Package Files

| file | role |
|---|---|
| `review_manifest.yaml` | map / scope / URL / review status の queue |
| `review_checklist.md` | akaghef が見る観点 |
| `presentation_mode_pjv43.md` | PJv43 としての仕様メモ |

## Manual Review Flow

1. `review_manifest.yaml` を開く
2. `status: ready` の item を上から開く
3. URL を browser で開く
4. `review_checklist.md` に沿って確認する
5. verdict を map の `PJ04 Presentation Review` scope に書く
6. 必要なら `batch_manifest.yaml` / `tasks.yaml` に残件化する

## Future Implementation Hook

本 package は将来の viewer Presentation Mode の seed として使う。

MVP 実装に進む時は、`idea/30_ux/slideshow/05_mvp_path.md` の暫定案を採用する。

- 1 step = 1 node
- 下部 overlay bar
- Prev / Next / Exit
- Right / Left key
- node details を narration として表示
- map JSON 内 `state.tour.steps[]` に保存
