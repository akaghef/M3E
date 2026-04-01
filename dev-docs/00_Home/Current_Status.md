# Current Status

最終更新: 2026-04-01

---

## 開発環境構成

| 環境 | ディレクトリ | 状態 |
|------|-------------|------|
| Alpha | `mvp/` | 開発停止（参照・検証用のみ） |
| Beta | `beta/` | **現行開発環境** |
| Final | `final/` | 安定版リリース環境（`migrate-from-beta.bat` 経由で反映） |

- 日常起動: `scripts/beta/launch.bat`
- Final 反映: `scripts/final/migrate-from-beta.bat`
- Final 起動: `scripts/final/launch.bat`（`M3E_DATA_DIR=%APPDATA%\M3E` が自動設定される）

---

## What Is Working

- ノード追加・編集・削除・折りたたみ（キーボードファースト）
- インライン編集（`Shift+Enter` / `F2` / ダブルクリック）
- キーボードナビゲーション（構造ベース ArrowLeft/Right/Up/Down）
- Undo/Redo（`Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`）
- Zoom/Pan、JSON 保存/読込
- 最小限の `.mm` インポート
- SQLite 永続化（起動時復元 + autosave）
- データディレクトリを `M3E_DATA_DIR` 環境変数で切り替え可能（Final は `%APPDATA%\M3E`）
- drag sibling reorder（drop proposal ベース、挿入ライン表示）
- Unit test（`npm test`）、Playwright visual regression test
- CI: Stage A unit tests（`mvp/**` 対象、`beta/**` 拡張は未着手）

---

## What Is Still Open

- CI パイプラインを `beta/**` に拡張（現状は `mvp/**` のみ）
- `ViewState` と persisted document state の分離が未完
- Model state 分離と schema v2 設計は完了（実装未着手）
	- 仕様: `dev-docs/03_Spec/Model_State_And_Schema_V2.md`
- reparent UI の refinement（ドロップターゲットのハイライト・拒否メッセージ）
- インポートメタデータの UI 表示未実装
- `.mm` サポートは MVP レベル（Freeplane 完全互換ではない）
- fit-to-content / focus-selected アクション未実装
- デモ品質: ビジュアルポリッシュ、aircraft.mm クリーンレンダリング

---

## Todo

### P5 — 開発インフラ（最優先）

- [ ] CI を `beta/**` に拡張（GitHub Actions workflow 更新）
- [ ] Beta 環境で unit test・visual test が通ることを確認
- [ ] `npm --prefix beta test` のパスを CI に登録
- [ ] Beta 用 Playwright baseline スクリーンショットを更新
- [ ] `EADDRINUSE` 時の起動リカバリ（ポート競合の自動検出・案内）

### P4 — デモ品質

- [ ] ノード間 spacing・text rhythm の統一（root/child のずれ修正）
- [ ] エッジの曲率・色の一貫性調整
- [ ] 選択状態のコントラスト改善（選択ノードが一目でわかること）
- [ ] 長テキストノードのレイアウト崩れ対応
- [ ] fit-to-content アクション実装
- [ ] focus-selected アクション実装
- [ ] `aircraft.mm` のクリーンレンダリング確認・修正
- [ ] `airplane-parts-demo.json` でフル編集フローを確認
- [ ] ツールバー密度の整理（日常使いに適した配置）
- [ ] 折りたたみ状態が常に明確に見えること

### Scope 遷移（仕様確定・実装待ち）

- [ ] `currentScopeId` / `scopeHistory` を ViewState に追加
- [ ] folder ノードのダブルクリックで EnterScope（text ノードとの動作分岐）
- [ ] ツールバー「← 戻る」ボタンで ExitScope
- [ ] ブレッドクラム表示（クリックで直接ジャンプ）
- [ ] スコープ外ノードの非表示フィルタ
- [ ] `Alt+Enter` / `Backspace` キーバインド
- [ ] ViewState のセッション保存・復元（`currentScopeId`）

### P3 — MVP 完全性

- [ ] ViewState と document state の分離を実装（schema v2 に基づく）
- [ ] インポートメタデータ（details / note / attributes）を UI に表示
- [ ] スタートアップ時に前回の ViewState（ズーム・選択・スコープ）を復元
- [ ] デモシナリオ文書作成（open → edit → reparent → save の 2 分ウォークスルー）
- [ ] reparent のドロップターゲットハイライト
- [ ] reparent の拒否時フィードバックメッセージ
- [ ] 非 leaf ノード削除の確認ダイアログ
- [ ] 500 ノードでの操作性確認

### P2 — テスト・CI 整備（継続）

- [ ] Hit-test のリグレッションカバレッジ追加
- [ ] SQLite round-trip テストを beta/ の unit test に移植
- [ ] Playwright visual baseline を beta/ 用に整備
- [ ] CI Stage B（visual test の自動化）設計・着手

### AI連携 — Phase 0（今すぐ着手可能）

- [ ] Markdown エクスポート実装（インデントツリー形式）
- [ ] コンテクストパッケージ生成 UI（スコープ選択 → テキスト出力 → クリップボードコピー）
- [ ] エクスポート出力にスコープ名・深さ制限オプションを追加

### AI連携 — Phase 1（Beta 安定後）

- [ ] Node.js サーバーに AI API プロキシエンドポイントを追加（`POST /api/ai/*`）
- [ ] `M3E_AI_API_KEY` 環境変数によるキー管理
- [ ] API キー未設定時に UI で AI 機能を無効化表示
- [ ] コンテクストパッケージ生成をサーバーサイドで処理

### AI連携 — Phase 2（Flash→Rapid 昇格支援）

- [ ] Flash Inbox UI の実装（種の一覧・昇格導線）
- [ ] 昇格時の親候補提案（AI による候補リスト表示）
- [ ] タイトル整形提案（口語テキスト → ノードラベル）
- [ ] 重複検出（既存ノードとの意味的類似警告）
- [ ] 提案スキップ・手動昇格パスの保証

### AI連携 — Phase 3（インライン構造提案）

- [ ] 構造改善提案の差分表示 UI（ghosted overlay）
- [ ] 提案ノードの色分け（追加/削除/移動）
- [ ] 採用 / 棄却 / 後で確認 の 3 択インターフェース
- [ ] 部分採用（提案の一部だけ適用）の実装
- [ ] 分割・統合・順序・親付け替え提案の各種実装

### P1 — 低優先度（deferred）

- [ ] alias 参照の UI 実装
- [ ] scope（folder world）遷移 UI
- [ ] 複数タブ並行編集
- [ ] Deep 差分比較ビュー
- [ ] Canvas 移行（SVG からの描画層切り替え）
- [ ] AI Phase 4: Deep 往復連携（構造送信 → 差分取り込み）

---

## Immediate Next Steps

1. **CI を `beta/**` に拡張**（P5 最優先）
2. **Markdown エクスポート実装**（AI連携 Phase 0 — 依存なし、今すぐ着手可能）
3. **Demo 品質**: spacing・edge curvature・selected-state contrast・長テキスト対応
4. `aircraft.mm` / `airplane-parts-demo.json` のクリーンレンダリング確認

---

## Related Documents

- MVP definition: [MVP_Definition.md](../02_Strategy/MVP_Definition.md)
- Band spec: [Band_Spec.md](../03_Spec/Band_Spec.md)
- Scope transition spec: [Scope_Transition.md](../03_Spec/Scope_Transition.md)
- AI integration spec: [AI_Integration.md](../03_Spec/AI_Integration.md)
- Model state/schema v2: [Model_State_And_Schema_V2.md](../03_Spec/Model_State_And_Schema_V2.md)
- Custom engine ADR: [ADR_003_Freeplane_Informed_Custom_Engine.md](../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)
- SQLite MVP ADR: [ADR_004_SQLite_For_Rapid_MVP.md](../09_Decisions/ADR_004_SQLite_For_Rapid_MVP.md)
- Data dir config ADR: [ADR_005_DataDir_Config.md](../09_Decisions/ADR_005_DataDir_Config.md)
- Test and CI/CD guide: [Test_and_CICD_Guide.md](../06_Operations/Test_and_CICD_Guide.md)
- Visual design guide: [Visual_Design_Guidelines.md](../04_Architecture/Visual_Design_Guidelines.md)
- Editing design: [Editing_Design.md](../04_Architecture/Editing_Design.md)
- Decision intake: [Decision_Pool.md](../06_Operations/Decision_Pool.md)
- Worktree separation rules: [Worktree_Separation_Rules.md](./Worktree_Separation_Rules.md)

## human memorandum(DO NOT EDIT HERE)
Linear<->Tree相互変換機能
AIコマンド操作
開発環境の移行
重要度ビュー
Flash機能
具象軸
AI integration
privacy, 機密保護
AI agentの役割設定
コンテキストエンジニアリングの自動化
Rapid, Deep分離
思想の再確認
日常使用ローンチ
Local, Cloudデータ同期
web公開
Flash実装
帯域の変更
ローンチ　デモ版
外部公開　
ライセンス


人間akaghef＋ＡＩ（codex,codex, claude)のチームで開発を行う。
役割は以下の通り
claude: 総合的作業
dev-betaブランチで作業する。マージ、仕様、タスク管理、finalへの移行
codexへ作業を外注する準備をする
codex1: visual作業
dev-beta-visualブランチで作業する。visual関連の作業
codex2
dev-beta-dataブランチで作業する。model, controller関連の作業
akaghef:上記のすべての確認および指示。負担が集中するので、できる限り自律させたい。



Role to be add:
news fetch: fetch news about security, AI, from the Internet
AI manager: observe tool use, prompt, commit log, token consumption
security manager: find potential security,privacy incident

How to keep enhancing AI's researching?
There are no training envirionments to enhance research skill, just doing current task only, not for educational usage.
Make AI to read book like finding something.
Do reasoning with knowledge as minimum as possible to find what to consider, sensible connection to find knowledge, learn usage of originality, 独創性.
数学書を発見的に読ませる練習　既存知識に頼らず、書いてある文脈から推論することを徹底させることで推論スキルを向上させる。知識成分を徹底的に排除して残るのが知能　知能という決勝
After evaporating knowledge, crystal of inteligence is lft. I want to find such inteligence, that looks like framework to consider things.
知能という結晶の姿を確認したい。それを視覚的なグラフとして見たい。
知能は木の最上位だとするなら、経験は次のレイヤーであり、知識はその次のレイヤーである。
知のレイヤーは知能＞思考経験＞知識　という順に並ぶ。　思考経験とは思考または体験を通じて得られる広義の経験である。
構造が複雑化するにあたり、キャッシングが重要となる。全範囲をロードしているとパフォーマンスにかかわる。必要に応じてメモリに流し込むという操作が必要になる。木の構造と、それを要約した木の構造を配置し、必要に応じてメモリに流し込む操作が必要となる。人間がマネジメントせずに、自動的に参照構造から拡大する構造にする。
本格的に木を用いて思考をするようになったら、キャッシングが必要になるだろう。AIの思考のためのレイヤーも必要「
