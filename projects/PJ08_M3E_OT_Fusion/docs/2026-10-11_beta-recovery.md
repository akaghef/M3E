# 未統合 Beta 成果の回収・通常配信の検証

2026-10-11。製品ソースの検証・本流配信対象は `f3e7c8fbc09332585189a51e0c01ca1699196d8b`。

## 範囲と明示保留

ユーザー指定により **OT の力学を通常 Disperse に採用する判断は明示的に保留**。独立 Force Lab の回収と描画整合だけを実施した。`disperse_layout.ts`、`webcola.ts`、`ot_force.ts` は回収前の本流から変更なし。

## 回収結果

| 成果 | 意味ごとの主な commit | 結果 |
|---|---|---|
| Freeplane 属性の往復 | `9778915` — shared parser と属性読取・出力を修正 | 本流配信済み |
| Vault 識別子・本文の往復 | `b2f166f` / `8c00060` — ID と末尾改行を保持 | Agent 表示・幅属性も往復するよう接続し、回帰検証済み |
| カメラ・幅・タッチ操作 | `99c83f9` / `b68f2eb` — 折返し・幅変更とカメラを接続 | #100 の局所編集・曲線・描画キャッシュを保持 |
| Agent node | `94dd676` / `e72b2fa` / `cf63d60` — 通常保存・Vite assets・通常 Escape/Undo 契約 | 保存済みマップへの表示、編集、移動、Undo、reload を検証 |
| Force Lab | `3025bee` / `9e87301` / `c0bb037` — 独立 Lab と最新 paint scene の共有 | Lab の WebGL・調整・pin を検証。製品エンジン採用は保留 |
| OT Overview / Detail | `8e6899e` / `a77ee14` — 最新の責務分離を回収し CI の一時ディレクトリ依存を解消 | neutral Overview、Detail、read-only controls を検証 |
| Agent Orrery 参照 Lab | `fb97ed4` / `cd38fc5` — issue / task / Agent / evidence fixture を接続 | 静的参照画面。新 Surface View、力学 solver、runtime 接続は導入していない |
| Viewer Panel Lab | `a896918` — 既存の独立 fixture を回収 | 通常アプリサーバー経由でパネル開閉を検証。最終製品 UI 採否は別 |
| favicon | `fbd5097` — 配布用 M3E アイコンを入口3画面へ適用 | source asset を本流へ回収 |
| 用語・分析・戦略 | `04dac78` / `d0c03f2` / `3cafd9b` / `68ad336` — Pane/Panel、nodeType/agent、PJ08 分析、現在地と保留を整列 | 正本と索引を更新 |
| 配信経路 | `69c0634` / `f3e7c8f` — compiled Lab への案内と full application server 検証 | 通常 4173 から追加 Vite process なしで Lab を表示 |

#97/#98/#99/#101/#102/#103/#107 の成果を直接本流へ回収した。#105 の修正は既に #100 経由で到達していた。これら8 Pull Request は closed として整理した（GitHub の merged 状態とは区別する）。旧 worktree・枝・未コミット原版は保持した。

Agent Orrery requirements は現行ファイルと同一だったため再導入しなかった。旧 Agent Card Lab は後続 Agent node へ吸収。旧 orchestration board の Agent=Session 定義は現行 NETWORK の識別・所有権と整合しないため、その backend を製品に重ねず原枝を保持した。PJ01 の Julia 成果は通常 Beta 回収とは別のサブプロジェクトとして保存されたまま。

## 検証

- Node 24 の隔離作業ツリー: 全 TypeScript 設定、単体94 files、824 passed / 12 skipped。
- ブラウザ: SVG/WebGL の局所編集・挿入・Undo、Mac/Windows の primary modifier と IME、幅変更・保存・reload、タッチを検証。幅検査は SVG を明示し、modifier は platform と一致させた。
- 一時 SQLite の application server: Agent node 2件、NETWORK 4件成功。実 source 設定を必要とする live observation 1件は skip。
- Agent Lab 1件、OT Overview/Detail 2件、Agent Orrery 2件成功。
- compiled Lab を application server 経由で開く7件成功。Force は software WebGL で正しさと操作を検証し、GPU 性能測定ではない。
- dependency boundaries、source copy drift、icon 52 frame regions、docs index、delivery rules、persistent rule gate、m3e-worker canonical/mirrors の一致を検証。
- GitHub の対象 SHA で Build & Test、Agent node icon import、Agent Instruction Lint、Installer & Script Lint の全 workflow 成功。

## 通常 Beta の配信

- primary `/Users/akaghef/dev/M3E` の `dev-beta` と `origin/dev-beta` が対象 SHA に一致。
- build 入力 `beta/` に tracked dirty 差分なし。依存一覧を検査し、既存 native SQLite が稼働 Node と一致することを一時 memory DB で確認した。
- primary の通常 `npm --prefix beta run build` を実行。既存 LaunchAgent `com.m3e.beta-nosync` を restart し、workspace / data / sync / observation の設定を維持。
- 稼働 PID は `43260`、cwd は `/Users/akaghef/dev/M3E/beta`。
- `http://localhost:4173/dist/browser/viewer.js` と primary build の SHA256 は両方 `1f506ad2dec7f23104d2771fa5e5ab90ba54f4b9944c9702d7744fe945fbb1ed`。
- 4173 の通常 Viewer を fresh browser で開き、page error 0。曲線と幅変更ハンドルを目視した。
- 4173 の Lab index → Agent node の往復で compiled ページを表示。追加 Vite process を必要としない。
- 個人 workspace に試験マップを作成していない。保存・幅変更・Undo の書込検証は fixture / 一時 DB で実施した。

スクリーンショットは repo 外の `/Users/akaghef/.codex/visualizations/2026/10/11/m3e-beta-recovery/` に保存。

## 残条件

OT 力学の通常 Disperse 採用、PJ08 Phase/最終 UI 採否、runtime の Role/Task binding と command owner adapter、複数実機の共有は今回の完了範囲へ拡張していない。Agent node の WebGL glyph は未対応で、Agent node を含む map は SVG。Black Dragon の素材だけ verified、12素材は pending-review。

primary の `2026-10-07.md` と空ファイル `m3e-rapid-mvp@0.1.0` / `vite` は未追跡のまま保持した。
