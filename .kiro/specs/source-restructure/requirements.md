# ソース構造整理 — 要件

2026-10-16。Director: KeenBell。状態: spec 承認済み（DC12、2026-10-16 23:03 JST）。設計判断 DC1〜DC11 とレビュー修正は合意済み。実装・計測・統合は未実施。実装開始は人間の確認後の別指示による。

## 目的と範囲

M3E の通常 Beta で正常だった操作を保ちながら、`beta/src` の責任、可変状態、依存方向、命名、配置を整理する。主戦場である ORRERY Telemetry 統合と保存・同期の信頼性を支える基盤整備であり、新しい画面・操作・データモデルを作る計画ではない。

この文書作成で書くのは `.kiro/specs/source-restructure/{requirements,design,tasks}.md` だけ。製品コード、試験、設定、既存 spec、Git の統合状態は変更しない。以下は後続の実装承認後に適用する要件である。`final/`、release、データ移行、未統合 worktree の一括回収は対象外。

用語は [Glossary](../../../docs/00_Home/Glossary.md) に従う。map、scope、親子関係の edge、GraphLink の意味と保存表現を変えない。seam interface は型付き契約境界であり、幾何の edge port と区別する。

## 根拠

| 根拠 | 確認した事実と限界 |
|---|---|
| [静的検査](../../../backlog/source-quality-static-scan.md) | IS1〜IS7。2026-10-16 の調査値。静的値は性能悪化の原因の証明ではない |
| `beta/src/browser/viewer.ts` | 現在 17,202 行。TypeScript AST によるトップレベル `let` 宣言・宣言子はともに154。キー入力、カメラ、通信、描画、入力、UI が相互参照 |
| `beta/src/node/start_viewer.ts` | 現在4,363行。同期 `createAppServer(): http.Server`、手書き振り分け、起動・保存・配信・SSE が同居 |
| 調査用 `functions.csv` | `src/` の関数3,279件、CCN 20超83件、ESLint の関数行数100超46件。元報告の「自前行数100超24件」とは入れ子の数え方が違う |
| `beta/vitest.config.js` | `tests/unit/**/*.test.{js,ts}` を収集。`src/node/*_test.ts` の7ファイルはこの収集対象外 |
| `.github/workflows/test.yml` | typecheck、依存・コピー検査、build、unit を実行。Playwright・操作性能は現状の必須 CI に含まれない |
| `beta/perf/run_webgl_pan_zoom.mjs` | pan/zoom の計測と fixture 整合検査がある。現状は数値を合否にせず、GPU renderer 文字列も結果に記録しない |

調査対象の source は、描画更新カウンターを追加した `7d26df9`。17,202行・154 let はその時点の調査実測であり、実装開始時の基準としては暫定。次の実装開始時に source・計測設定・基準値を再計測し Director が封じ、時点の違う数字を混ぜない。

## Director 所有の要件

### RQ1 挙動の不変

ユーザーから見える操作、表示、HTTP API、起動方法、保存データを変えない。既存の全試験を通す。新しい失敗、失敗試験の削除、無断 skip、snapshot の自動更新を合格にしない。基準版で既に失敗する試験も記録し、全試験合格の要件を満たしたとはしない。

カメラ・描画に触れる段階は既存 runner による前後比較を必須にする。フレーム間隔 p95・最大、long task の回数・合計時間・最大時間を比較する。DC6・DC10 の固定手順で基準を超えたら不合格。キー入力、pointer、renderScene、A/B 調査にも適用する。全体最大値の扱いと統計上の合否は design に明記する。機能試験、最終座標、CPU 計測カウンターだけで操作感の不変を宣言しない。

HTTP は旧版と新版を独立に実行し、status、主要 header、body、404/405、HEAD、本文サイズ上限、SSE 接続・切断を比較する。保存は isolated workspace で保存・reload・再起動後の readback、競合、通知を確認する。

### RQ2 自作の禁止とルーティング

Fastify とその既存ルーターに木構造の URL 振り分けを任せる。`app.ts` は共通設定と分野別サブルーターの登録を担当し、`routes/<分野>.ts` は1分野1ファイルの route 宣言と短い処理にする。業務処理は既存サービスへ委譲する。手書き `parse*Route` / `is*Route` と同等の URL 振り分けを最終的に全廃する。関数の改名だけでは廃止と認めない。

分野ごとの移行中だけ、未移行経路を既定ルートから旧振り分けへ流す。分野の移行と同時に旧 if・parser を削除する。最終的に旧振り分け自体を削除する。MCP・SSE の raw HTTP 互換には Fastify の標準拡張点を使い、独自ルーター・独自サーバーラッパーを作らない。

### RQ3 ゲートが先

最初の実装段階で ESLint 9 / typescript-eslint 8 による複雑度と関数行数、`viewer.ts` の物理行数・トップレベル `let` 数を CI で検査する。新規関数の上限は CCN 20、関数行数100。行数は ESLint の入れ子込み、空行・コメント除外とする。既存違反は関数別の現状値を上限にし、新しい違反を許可しない。

以後の実装段階では全指標を非増加とし、対象の1指標以上を厳密に減らす。基準値の無条件再生成、対象除外、巨大な `const` state への単純置換、移動・改名による違反消失は認めない。DC11 により「製品 src 内の試験・デモ・PJ 専用ファイル数」も指標に加える。A/B 調査は実装段階とは別の進行ゲートとし、静的値の減少条件を適用しない。

Director レビューの追加条件として、labs を除く製品 src の CCN 50超関数を全列挙し、責任ごとに分割して対象と分割後の関数を20/100以内にする。`blueprint_importer`、Rapid のモデル、MCP service 等を「悪化させない」だけで完了にしない。Director 指定の `localTopicSuggestions` も含め、保存algorithm・API・出力は変えない。

ESLint 基準/方針、性能比較器/policy、段階のゲート目標は Director 所有。実装者は変更案を出すのみで、自分で上限・基準・合否を変更しない。Director が独立実行して基準の固定と段階の合否を判定する。

### RQ4 viewer.ts の解体と状態所有

| 独立させる責任 | 必須の完了条件 |
|---|---|
| キー入力 | コマンドの一覧表と既存 `viewer_keyboard.ts` に移譲し、巨大な keydown 本体を削除。優先順位・修飾キー・IME・focus・read-only を保持 |
| カメラ・viewport | fit、パン、ズーム、アニメーションの書込 owner は1つ。各入力経路はその命令を呼ぶ |
| 描画パイプライン | `renderScene` を独立。既存 layout / node draw / edge / WebGL projection を再利用。元の実装を viewer に残さない |
| 通信・同期・collab クライアント | 接続、timer、request、再接続、保存順序の owner を明示。表示 UI から分離 |
| ポインタ入力 | SVG/WebGL の hit-test 差異を保持したまま入力とジェスチャー状態を独立。camera state へ直接書かない |
| 残る UI・選択・編集等 | 分野ごとに切り出し、`viewer.ts` を起動配線に限定する |

モジュール全体から書換可能な状態は、分野別 factory が所有する非公開 state へ移す。外へは読み取り専用 snapshot と命令メソッドを出す。元の154変数だけでなく、可変 `const` object / Map / Set と closure の資源も所有台帳に含める。共有の巨大 ViewerState、新規 Redux / Zustand、汎用イベント基盤は導入しない。

最終の設計目標は `viewer.ts` 2,000行以下、トップレベル `let` 0。これは事前の合否目標であり、達成済みの数字ではない。単なるファイル分割で複雑な関数と双方向依存を移植するだけでは完了しない。

### RQ5 命名と配置

`start_viewer.ts` のサーバー本体を実態に合う `server/`、起動を `start_server.ts` に分ける。`rapid_mvp.ts` の中核モデルを `rapid_model.ts` にする。既存起動/import 互換が必要な旧 path は業務処理のない互換入口だけにする。保存キー、API field、公開利用者の依存を無断変更しない。

`dogfood_run_*`、`pj03_demo`、`pjv34_*` と `src/node/*_test.ts` を、それぞれ手動運用 scripts、PJ の scripts、tests に移す。実利用と参照を調べ、移動後もコマンドと試験の実行を維持する。lab は製品コードと別に集計し、独立 app を作り直したり一括削除したりしない。

### RQ6 小さく出荷・巻き戻しできる段階

各実装段階を単独で `dev-beta` に統合・revert できる範囲にする。各段階に既存挙動、検証コマンド、ゲート値の変化目標、性能検証の適否、依存、巻き戻し単位を定める。サーバー移行は1分野1単位。複数段階を未統合のまま積み上げない。

新しい schema/data migration を伴わず、rollback は該当段階の source・依存・基準ファイルを一緒に revert する。後続に依存される段階を戻すときは依存する後続を逆順に戻す。結果と残条件は [Worktree Separation Rules](../../../docs/06_Operations/Worktree_Separation_Rules.md) に従って記録する。

### RQ7 未解決の悪化の原因確定

fit の重複実行を除いた `e2faa94` 以降の再起動後パン・ズーム悪化は、現時点で原因未確定。最初に `e2faa94^` と `e2faa94` を独立 build した A/B 調査を行い、ゲート作成と並行して進める。調査は本流の製品コードを変更しない。

同じ fixture、browser、runner、実機 GPU で比較し、報告された操作の再現と差分部位への介入検証を必要とする。単に差が出ない、試験が緑、カウンターが動く、という結果で原因確定にしない。原因未確定なら camera の構造変更を開始しない。修正が必要なら原因修正を別の承認・変更として扱い、構造整理と混ぜない。

## 受け入れ証拠

| 評価軸 | 証拠 |
|---|---|
| AX1 挙動 | 旧版/新版の契約比較、全既存試験、通常 Beta の対象操作 readback |
| AX2 構造 | 基準差分、所有台帳、削除した本体、依存方向検査、route parser 全廃 |
| AX3 操作性能 | 妥当性検査済み GPU runner 生データ、固定した基準値、指標別判定、全体最大値の報告 |
| AX4 出荷可能性 | 段階単位の検証・統合・push・通常 Beta 確認、revert 手順 |

本 spec の確定は実装承認・製品改善完了とは区別する。未測定の基準値、未実施試験、実行環境不足を合格として埋めない。
