# Dogfood: Lean 形式化のまとめを M3E で保持する

最終更新: 2026-10-26

## 目的

Research の Lean 形式化作業（PJ261015）の現在地・最前線・判断を、AI agent が M3E の scope 上で維持する。
実利用で起きる不具合（特にノード消失）を、利用者の痛みとして Feedback に流すことが目的である。

## 正本と置き場

| 対象 | 置き場 | 扱い |
|---|---|---|
| 形式化の正本 | Windows `C:\Users\Akaghef\data\21_研究\threads\PJ261015\`（`README.md`・`ACTIVE.md`・`LEDGER.md`・`docs/reports/lean-cas-farthest-roadmap.md`・`data/*.json`） | Mac からは `ssh win` で読み取りのみ。書き込まない |
| まとめ | M3E マップ「研究」> scope「PJ261015 Lean形式化」 | AI agent が MCP の意味操作で更新する |
| 消失検出の基準 | Mac `~/.m3e/dogfood/pj261015-lean.json` | `map-loss-guard.mjs record` が書く |

まとめは正本の要約であり、消えても正本から作り直せる。各ノードの属性「出典」に正本のパス（`threads/PJ261015/` 起点）を残す。

## 更新手順（AI agent）

1. 正本の変化を読む：`ACTIVE.md` 冒頭の current 段落、最新 replay の `data/*-replay.json`、`LEDGER.md`。
2. MCP（`m3e_context` → `m3e_create` / `m3e_update`）で scope を更新する。正本にない主張を足さない。
3. 意図した書き込みの直後に基準を記録する：

   ```bash
   node scripts/ops/map-loss-guard.mjs record --target <scope URI> --ledger ~/.m3e/dogfood/pj261015-lean.json
   ```

   意図した削除も同じく記録する。記録を省くと、次の検査で消失として報告される。

4. 更新の前にも `check` を実行し、前回記録からの消失がないことを確かめる。

## 消失検出

`check` は記録済みのノードが無くなった場合と、本文が空になった場合を消失とみなし、終了コード 2 で終える。消失は `m3e_feedback` に自動で記録される。`--notify` を付けると macOS の通知も出る。サーバーに到達できない場合は終了コード 3 で、消失とは区別する。本文の変更は「記録されていない変更」として表示するが、消失には数えない（人間が GUI で編集することがあるため）。

定期検査は launchd agent `com.akaghef.m3e.map-loss-guard`（30 分ごと、`--notify` 付き）で実行する。

## Feedback の扱い

- 消失・不具合・不足操作は `m3e_feedback` に記録する（記録先は app の feedback ログ）。
- 確認済みの不足：MCP に GraphLink を作る操作がないため、段の依存は属性「依存」に文字列で保持している。

## 作業を止めない

M3E が使えない間も形式化の作業自体は止めない。まとめの更新は正本の文書だけで続け、M3E が復旧してから scope に反映する。
