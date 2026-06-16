# Capture / Ingest — 入力・取り込み体験設計

ノードを M3E マップに「入れる」までの体験設計に関するブレインストーミング。
**研究者 akaghef が、思いつき・対話・文献・画像・コードを最小摩擦でマップに送り込み、
後でまとめて triage する** ためのチャネル網と処理経路を網羅的に並べる。

レビュー保留のため、各論点について **複数の選択肢を並べ、決定はしない**。
後で論点 ID 単位で選んで実装方針を確定する。

## 方針

- 採用判断はしない（A1-A20 全候補を並列）
- 実装は考えない（コンセプトと体験設計に集中）
- 複数案を比較表で並べる
- privacy 制約（policy_privacy）を全チャネルで意識
- 既存 idea/ ブレスト（slideshow / keyboard_modes / map_views / automation_obstacles）と接続
- 「入れる体験」と「triage 体験」は分離（Capture と Ingest と Triage の3層）

## ファイル構成

- [01_concept.md](01_concept.md) — 何を作るか、なぜ、ユースケース、既存ツール差分、capture と triage の分離原則
- [02_channels.md](02_channels.md) — 入力チャネル候補列挙（A1-A20、00_topic_pool A1-A10 拡張）
- [03_processing_pipeline.md](03_processing_pipeline.md) — 取り込み後の処理（句点分割・分類・要約・triage 投入）
- [04_runtime_ux.md](04_runtime_ux.md) — 取り込み体験の UI / 操作系バリエーション
- [05_data_privacy.md](05_data_privacy.md) — データモデル・永続化・暗号化・外部依存・互換性
- [06_mvp_path.md](06_mvp_path.md) — 最小実装案、横断観察、優先順位、未決質問

## 全体俯瞰 / 論点マップ

| 層 | 論点 | 扱うファイル |
|---|---|---|
| **Why** | 既存ツール（Logseq/Obsidian/Notion）と何が違うか | 01 |
| **Who/When** | 研究者が「入れる」シーン5+ | 01 |
| **Channel** | A1-A20: 何経由で入れるか | 02 |
| **Pipeline** | P1-P12: 入れた後どう加工するか | 03 |
| **UX** | U1-U15: どんな見た目・操作で入れるか | 04 |
| **Data** | D1-D10: どこに何の形で残すか | 05 |
| **Privacy** | L1-L8: 機微情報をどう扱うか | 05 |
| **MVP** | M1-M6: どこから始めるか | 06 |

## 論点一覧（早見表）

### Concept（01）
- C1. 「Capture」「Ingest」「Triage」の3段階を分離するか
- C2. 既存ツール（Drafts/Logseq/Notion）に対する M3E の差別化軸
- C3. 取り込み速度（ms）を成功指標にするか
- C4. 「壊れててもいい・後で直せばいい」許容度
- C5. 取り込み元の出典（source）をどこまで残すか

### Channel（02）
- A1-A10: 00_topic_pool の既存サブトピック
- A11-A20: 拡張候補（IFTTT/Zapier、RSS、写真、ボイスメモ、Apple Notes 等）
- Ch1. プッシュ型（ユーザーが送る） vs プル型（M3E が取りに行く）
- Ch2. 同期 vs 非同期
- Ch3. ローカル vs クラウド経由

### Pipeline（03）
- P1. 句点・段落での自動分割
- P2. 自動タグ付け / カテゴリ分類
- P3. 要約・タイトル自動生成
- P4. 重複検出（D1 と接続）
- P5. 関連ノード自動 link 提案（C4 AI 候補と接続）
- P6. 引用・出典のメタデータ抽出
- P7. 言語検出 / 翻訳
- P8. OCR / Whisper 等の前処理
- P9. AI 要約パスを通すか通さないか
- P10. triage キューへの投入規則
- P11. 失敗時の挙動（retry / dead letter）
- P12. 取り込み量レート制限

### Runtime UX（04）
- U1. メニューバー常駐ウィジェット
- U2. ホットキー一発（Cmd+Shift+. 等）
- U3. 音声常時待機
- U4. メールベース
- U5. 共有シート（モバイル）
- U6. ブラウザ拡張（コンテキストメニュー / popup）
- U7. CLI / npx コマンド
- U8. ドラッグ&ドロップ
- U9. クリップボード監視
- U10. Markdown ファイル監視
- U11. 専用 capture ページ（/capture）
- U12. 取り込み確認のフィードバック（音/トースト/振動）
- U13. オフライン挙動とキューイング
- U14. 1ノードずつ vs バッチ
- U15. capture 後にすぐ表示するか後でまとめて triage か

### Data / Privacy（05）
- D1. scratch ノード形態（フラット vs 階層）
- D2. メタデータスキーマ（source/timestamp/captured_via 等）
- D3. 添付ファイル（画像/PDF/音声）の保管場所
- D4. 取り込み元 raw データの保持期間
- D5. ワークスペース選択（複数 vault 対応）
- D6. M3E json 直書きか別ストアか
- L1. クライアント暗号化の必須範囲
- L2. AI パイプライン送信前の検閲
- L3. クラウドリレー（メール/モバイル）の中間データ削除
- L4. 出典 URL の匿名化オプション

### MVP（06）
- M1. どの2-3チャネルから始めるか
- M2. パイプラインの最小構成
- M3. UI の最小実装
- M4. 暗号化なし MVP の許容範囲
- M5. 段階的拡張ロードマップ
- M6. 既存 m3e-scratch skill との接続

## キーメッセージ

1. **Capture と Triage は分離設計が筋がよい** — 「入れる時」は思考停止、「整理する時」は集中。
   両方を同時に求めると入力摩擦が増える。
2. **チャネル数より「入れた後の信頼感」が重要** — 「ちゃんと scratch に入った」確信がないと
   ユーザーは結局メモ帳に戻る。フィードバック設計（U12）が肝。
3. **AI パイプライン（P3/P5/P9）はオプトイン推奨** — privacy 制約と速度トレードオフ。
   生 capture を保つルートと AI 加工ルートの2系統が必要。
4. **モバイルと音声は研究者の現場（電車・散歩・実験室）に直結** — F2 と A1 を組み合わせると
   「歩きながら捕捉」が完成。組み合わせ高効果ペアの代表。
5. **既存ツール（Drafts/Apple Notes/Obsidian Quick Add）を完全置換しなくてよい** —
   それらを「源流」として import できれば M3E は集約点になれる。

## 関連 idea/ クロスリンク

- `idea/keyboard_modes/05_capture_navigation.md` — Capture mode のキー設計
- `idea/keyboard_modes/09_numpad_quick_input.md` — テンキー高速入力
- `idea/automation_obstacles/` — 自動化の限界と「人間が触る」ライン
- `idea/slideshow/` — 取り込んだ素材の出力経路（双対）
- `idea/map_views/` — capture 直後の表示ビュー候補
- `idea/00_topic_pool.md` — A セクション（A1-A10）が本ブレストの起点

## 既存メモリ・ドキュメントとの接続

- `project_overview` — 研究思考支援ツール、graph UI、React+TS+SVG
- `project_projection_vision` — 世界モデル→射影。**入力品質が射影品質を決める**
- `policy_privacy` — クライアント側暗号化必須。AI 経路と直交
- `feedback_dev_map_size` — DEV map 50-300。capture 由来の scratch が肥大化したら scope 切替
- `m3e-scratch` skill — 既存の scratch 投入経路。本ブレストはその拡張
- `project_alglibmove_dogfood` — 認知層の不足。capture pipeline は認知層の入口
