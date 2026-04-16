# Privacy / Security — プライバシー・セキュリティ体験設計

研究者 akaghef が **科研費・実験データ・人物情報・パスワード・未公開仮説** を
M3E に安心して投げ込み、AI と協働しつつ漏洩しないための体験・構造を網羅的に並べる。

policy_privacy（クライアント暗号化必須・E2E 同期・AES-256-GCM）と
project_projection_vision（半年で世界モデル→射影実用化、科研費出力）の交点。
M3E が研究の「思考母艦」になるためには、機微情報を追い出さずに **同居** させる必要がある。

レビュー保留のため、各論点について **複数の選択肢を並べ、決定はしない**。
後で論点 ID 単位で選んで実装方針を確定する。

## 方針

- 採用判断はしない（L1-L40 全候補を並列）
- 実装は考えない（暗号方式・UI・データ構造の選択肢に集中）
- 複数案を比較表で並べる
- policy_privacy（E2E、AES-256-GCM、ローカルキー1本）を上限制約として保持
- AI 統合と機微情報の交点（Privacy × Agent）を最重要交差として扱う
- 「使いやすさ」と「安全性」のトレードオフを正直に表に出す
- 既存 idea/（capture_ingest L1-L4, automation_obstacles）と接続

## ファイル構成

- [01_concept.md](01_concept.md) — 何を守るか、なぜ、ユースケース5+、既存ツール差分、3層モデル
- [02_threat_model.md](02_threat_model.md) — 脅威モデル T1-T12、機微度分類 S1-S5、レーン分離
- [03_encryption_options.md](03_encryption_options.md) — 暗号化方式・粒度・キー管理の選択肢（L1 系）
- [04_masking_detection.md](04_masking_detection.md) — 機微検出・AI 送信前マスキング（L2/L3/L5 系）
- [05_vault_separation.md](05_vault_separation.md) — マルチ vault・workspace 分離（L4 系）
- [06_ux_data.md](06_ux_data.md) — UI バリエーション・データモデル・互換性
- [07_mvp_path.md](07_mvp_path.md) — MVP、優先順位、横断観察、未決質問

## 全体俯瞰 / 論点マップ

| 層 | 論点 | 扱うファイル |
|---|---|---|
| **Why** | なぜ M3E に privacy が必須か | 01 |
| **Who/When** | 研究者が機微情報を扱うシーン | 01 |
| **Threat** | T1-T12: 何から守るか | 02 |
| **Sensitivity** | S1-S5: 機微度の段階分け | 02 |
| **Encryption** | E1-E10: 何をどう暗号化するか | 03 |
| **Detection** | M1-M10: 機微情報をどう検出するか | 04 |
| **Masking** | Mk1-Mk8: 検出後の処理 | 04 |
| **Vault** | V1-V10: 分離戦略 | 05 |
| **UX** | U1-U12: 体験バリエーション | 06 |
| **Data** | D1-D8: データモデル・互換性 | 06 |
| **MVP** | Mv1-Mv6: どこから始めるか | 07 |

## 論点一覧（早見表）

### Concept（01）
- C1. 「機微情報を M3E に入れる」を許容するか、追い出すか
- C2. 既存ツール（Obsidian Encrypt, Standard Notes, Cryptee）との差別化
- C3. 「暗号化された安心」より「漏洩しない確信」をどう作るか
- C4. ローカルファースト原則と AI クラウド送信の両立
- C5. 3層モデル: At-Rest / In-Transit / In-AI-Pipeline

### Threat Model（02）
- T1-T6. 漏洩経路（端末紛失・同期サーバー・LLM 送信・スクショ・第三者画面・OS 共有）
- T7-T12. 内部脅威（誤操作・過去ノード露出・履歴・キャッシュ・index・export）
- S1-S5. 機微度（公開可・準公開・社内・機密・極秘）
- レーン分離原則: ノード単位 / vault 単位 / workspace 単位の3粒度

### Encryption Options（03）
- E1-E5. 粒度（ファイル全体 / vault / ノード / フィールド / セクション）
- E6-E8. キー管理（単一キー / vault 別 / per-node DEK）
- E9-E10. アルゴリズム選択（AES-GCM / XChaCha20 / age）
- 互換性（policy_privacy: AES-256-GCM 既決を上限とする）

### Masking & Detection（04）
- M1-M5. ルールベース検出（regex / dictionary / 名前リスト / 住所 / メアド / 電話）
- M6-M10. 統計・ML 検出（NER / LLM 自身による検出 / embedding 距離）
- Mk1-Mk4. マスキング方式（全置換 / トークン化 / 部分マスク / placeholder + decrypt-on-return）
- Mk5-Mk8. AI 送信前ゲート（自動却下 / 警告 / 再構成 / ローカル LLM 退避）
- L5. ローカル LLM 限定モード

### Vault Separation（05）
- V1-V4. 単一 workspace 内の vault 分離（タグ / namespace / subtree / 別ファイル）
- V5-V7. 複数 workspace の使い分け（公開/私用/機密）
- V8-V10. 切替 UX（手動 / 文脈自動 / セッション分離）
- 既存の workspace パラメータと接続

### UX & Data（06）
- U1-U6. 状態表示（南京錠アイコン / 色分け / 半透明 / blur / locked icon / vault badge）
- U7-U12. 操作（unlock 期間 / 再認証頻度 / panic ロック / readonly モード / 共有禁止フラグ）
- D1-D8. データモデル（attribute / metadata / sidecar / 別 store / sync 互換 / backup 互換）

### MVP（07）
- Mv1-Mv6. どの組み合わせから始めるか
- 横断観察（チャネル × 機微度 × AI 経路）
- 未決質問

## キーメッセージ

1. **「暗号化済」と「AI に送らない」は別レイヤ** — At-Rest 暗号化（E1-E10）と
   Pipeline ガード（Mk5-Mk8）は独立に設計しないと混同事故が起きる。
2. **検出は「漏らさない」より「警告で止める」が現実解** — 完全自動は誤検出 / 見落とし両方が出る。
   研究者の判断を残す UI（U7-U12）が肝。
3. **vault 分離はファイル分離が最も信頼でき、UI 分離は気休め** — 実装簡便な「タグで隠す」
   方式は事故の温床。policy_privacy の精神では別キー・別ファイルが筋。
4. **ローカル LLM 限定モード（L5）は「機微情報 × AI 統合」の唯一の正解候補** —
   ただし性能トレードオフが大きく、研究用途で使い物になるかは別問題。
5. **UI で「いま自分が触ってるノードの機微度」を一秒で見える化することが最重要** —
   暗号化されていても、画面共有・スクショ・他人の覗き込みで漏れる。視認性が物理層の防衛線。

## 関連 idea/ クロスリンク

- `idea/capture_ingest/05_data_privacy.md` — capture チャネルでの privacy 論点（L1-L4）
- `idea/automation_obstacles/05_m3e_strategy.md` — ローカルファースト・vault 同期の戦略
- `idea/ai_agent_deep/` — AI 統合と privacy の交点（Mk5-Mk8 と直結）
- `idea/00_topic_pool.md` — L セクション（L1-L6）が本ブレストの起点

## 既存メモリ・ドキュメントとの接続

- `policy_privacy` — **最上位制約**。E2E、AES-256-GCM、`~/.m3e/sync.key` 1本、外部依存なし
- `project_projection_vision` — 科研費・申請書を扱う = 未公開予算情報・人事情報を保持する
- `project_overview` — React+TS+SVG、ローカルファースト
- `feedback_dev_map_size` — 機密 vault は別 workspace = scope 管理と整合
- `feedback_branch_cleanup` — 機密 workspace のバックアップ・削除も別ルール
- `project_alglibmove_dogfood` — 認知層の入口で機微情報が混ざる = ここで篩う必要
