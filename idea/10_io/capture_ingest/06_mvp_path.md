# 06. MVP Path — 最小実装案・横断観察・未決質問

5ファイルの選択肢を踏まえて、**どこから始めるのが筋がよいか** の最小経路。
本ファイルは横断観察と未決質問の集約も担う。

---

## M1. どの2-3チャネルから始めるか

### 候補セット

| MVP セット | 含むチャネル | 理由 | 実装日数感 |
|---|---|---|---|
| MVP-A 即効型 | A10 menu bar + A2 ブラウザ拡張 | 1日で「使える感」 | ~5日 |
| MVP-B 研究者型 | A3 PDF + A8 AI 履歴 | 研究ワークフロー直結 | ~10日 |
| MVP-C モバイル型 | A1 音声 + A9 共有シート | 散歩中の捕捉 | ~14日 |
| MVP-D 自走型 | A14 ファイル監視 + A15 webhook | 既存ツール延命 | ~3日 |
| MVP-E ドッグフード型 | A7 git + A8 AI 履歴 | M3E 自身の dogfood | ~3日 |

**推し度**: MVP-D が即着手・低コスト・既存資産活用。
そこから MVP-A → MVP-B → MVP-C へ拡張するのが筋。

---

## M2. パイプラインの最小構成

```
[file/webhook] → 生 text 受信 → scratch 直挿入 → 確認通知
```

最小構成で省くもの:
- ❌ AI パス（P9-a）
- ❌ 自動分割（P1-a）
- ❌ 自動タグ（P2-b: チャネルタグだけ）
- ❌ 重複検出（P4-a）
- ❌ link 提案（P5-a）

含むもの:
- ✅ チャネルタグ
- ✅ timestamp + source メタ
- ✅ ローカル退避（P11-c）
- ✅ scratch 直挿入

→ Pattern PP1（ミニマル）。

---

## M3. UI の最小実装

### MVP-D ベース（ファイル監視 + webhook）
- UI: 不要（バックグラウンド動作）
- 確認: scratch エリアに「3件届いてます」バッジ
- 設定: `~/.m3e/capture-config.json`

### MVP-A 拡張時に追加
- menu bar tray icon
- popup input box（U1-b）
- ブラウザ拡張 popup（U6-a）

### M3E 既存 UI への追加
- scratch エリアに「未 triage」フィルタ（既存）
- 「source: voice」のような小チップ表示
- triage モードへの遷移ボタン

---

## M4. 暗号化なし MVP の許容範囲

policy_privacy との折衝。

### 案
- M4-a 暗号化必須から始める（遅いが安全）
- M4-b 機微タグ無いものは平文で MVP
- M4-c MVP は平文、本実装で暗号化
- M4-d チャネル別（メール・Slack 等は MVP から E2EE）

**推し度**: M4-b。`#secret` `#personal` タグ付きのみ暗号化必須、それ以外は MVP は平文。

---

## M5. 段階的拡張ロードマップ

### Phase 0（既存）
- m3e-scratch skill による手動 scratch 投入
- Claude Code 経由のテキスト追加

### Phase 1（MVP-D, ~3日）
- ファイル監視 + webhook 受信
- チャネルタグ + timestamp メタ
- localStorage queue
- 失敗時 dead letter

### Phase 2（MVP-A, ~5日）
- menu bar widget（U1-b）
- ブラウザ拡張（U6-a 最小）
- ホットキー（U2）
- 直前選択ノード親（U19-b）

### Phase 3（暗号化基盤, ~5日）
- L1-c チャネル別暗号化
- L2-b パターン検閲
- D7 設定保管

### Phase 4（MVP-B, ~10日）
- PDF 取り込み（A3-c GROBID or A3-b 見出し）
- AI 履歴取り込み（A8-a Claude export）
- P6 引用メタ抽出

### Phase 5（MVP-C, ~14日）
- 音声常時待機（A1-b push&talk）
- モバイル PWA + 共有シート対応（A9-b）
- F2 と統合

### Phase 6（自走 AI, ~7日）
- 夜間 batch（PP4）
- 自動 link 提案（P5-e）
- 重複検出（P4-d）
- C10 自走 AI と統合

### Phase 7（コラボ・共有）
- 共有 vault（L7）
- 共同 capture
- E1/E2 と接続

---

## M6. 既存 m3e-scratch skill との接続

### 案
- M6-a m3e-scratch を内部で使う（既存 API 経由）
- M6-b 直接 m3e-map.json を書く（独自経路）
- M6-c REST API（既存）に capture endpoint 追加
- M6-d skill 経由で全部統一

**推し度**: M6-c（REST API 拡張）。既存資産活用 + 外部から呼びやすい。

---

## 横断観察: ファイル間で繰り返し出てきたパターン

### 観察 O1. 「即時」と「夜間」の二系統が必要
- 即時: 摩擦ゼロで scratch 投入（PP1）
- 夜間: AI で重複検出・link 提案・要約（PP4）
- → 02 の S1-S5 と 03 の PP1/PP4 が同じ思想

### 観察 O2. チャネル別最適化が一律ルールより筋
- 分割（P1-e）、フィードバック（C6/U12）、暗号化（L1-c）すべて
  「チャネル別に方針を変える」案が推し
- → 「universal capture pipeline」より「channel-aware pipeline」

### 観察 O3. capture と triage は分離が原則
- C1-a / U16-a / U15-b 全部「分離」を支持
- 「即整理派」（C1-c, U16-c）も否定はしないが既定は分離

### 観察 O4. AI は opt-in が筋
- P9-c, P9-e, P5-e, L1-c 全部 opt-in を推す
- 理由: privacy + 速度 + コスト + 信頼感
- → 「AI 全乗せ MVP」（PP2）は地雷

### 観察 O5. 失敗時のデータロス絶対回避
- C7-c, P11-c, U13, L6-b 全部「データを失わない」を最優先
- 理由: 一度失敗体験すると capture を信用しなくなる
- → ローカル退避 + dead letter は MVP から必須

### 観察 O6. 出典（source）メタは将来の足場
- C5-a, P14-c, D2-b, L8-c 全部「source を残す」を推す
- 理由: time travel I1, 引用 P6, AI 再現 L8 全部に効く
- → メタ削減で速くしようとすると後悔

### 観察 O7. M3E 既存資産の再利用機会が多い
- m3e-scratch skill, ai_subagent.ts, REST API, m3e-map.json
- 新規実装より既存拡張で半分以上カバー可能
- → ゼロから作るより「既存 + α」設計

---

## 高レバレッジ組み合わせ（再掲・拡張）

00_topic_pool で挙げられたペアの再評価:

| 組み合わせ | 効果 | 実装順 |
|---|---|---|
| **A8 + B1** | AI 対話 → 論文化 | Phase 4 → 出力ブレスト |
| **A1 + F2** | 散歩中の音声捕捉 | Phase 5 |
| **A3 + B1** | 論文 → 論文ドラフト | Phase 4 → 出力 |
| **PP4 + C10** | 夜間自走で自動整理 | Phase 6 |
| **A10 + U2** | menu bar + hotkey | Phase 2 |
| **L1-c + L2-b** | 暗号化 + AI 検閲 | Phase 3 |

---

## 未決質問（重要度順）

### Q1. capture 専用ストア vs 直書き（D6）
- staging を分けるか、scratch に直接書くか
- 影響範囲: 全パイプライン
- 既存 m3e-map.json 構造を尊重するなら直書き、time travel I1 を見据えるなら staging
- → **akaghef の判断必要**

### Q2. AI 統合の depth
- ai_subagent.ts と統合するか、capture 専用 agent を立てるか（P13）
- 影響: 実装規模、保守性
- → **要設計判断**

### Q3. 暗号化の責任範囲
- M3E 全体の暗号化方針が未確定の場合、capture が先に決めて後を縛るか
- policy_privacy をどこまで具体化するか
- → **policy 側で決まらないと進めない**

### Q4. モバイル投資の規模
- ネイティブアプリ（A9-a）か PWA（A9-b）か
- ネイティブは投資大、PWA は機能制限
- → **akaghef のモバイル使用頻度次第**

### Q5. AI 取り込みのコスト管理
- A8 で Claude/GPT 履歴を AI 要約すると API コストがかかる
- ローカル LLM（Ollama 等）を選択肢に入れるか
- → **コスト vs 品質**

### Q6. メール経路の運用
- A5 のためだけにメールサーバ運用するか
- Mailgun 等のサービス使うか
- privacy ポリシーと両立するか
- → **運用負荷の許容度**

### Q7. M3E 開発自身のドッグフード優先度
- A7 git + A8 AI 履歴で M3E 開発履歴を M3E に取り込む
- project_alglibmove_dogfood と関連
- → **dogfood 重視なら MVP-E 優先**

### Q8. capture history のサイズ問題
- 全 capture 履歴を保持すると map が肥大
- DEV map ~50-300 ノード制約とどう折り合うか（feedback_dev_map_size）
- → **scope 切替・archive 戦略要設計**

### Q9. 「triage 不要」設計の可能性
- いっそ scratch を作らず、capture 時に AI が即適切な場所に置く
- 信頼できれば最強、信頼ない時に地獄
- → **C1-c の本格検討価値あり**

### Q10. 取り込み演出の「やりすぎ」境界
- U12-e リッチアニメは楽しいが集中阻害
- どこまで演出するか
- → **A/B 試したい**

---

## 推奨「最初の一歩」案

判断を迫られたらこの順で:

### Step 1（即着手可、~3日）
- A14 ファイル監視: `~/m3e-inbox/*.md` を scratch 化
- M6-c REST API endpoint `POST /capture` 追加
- D2-b 標準メタ
- P11-c ローカル退避

### Step 2（~5日）
- A2 ブラウザ拡張（minimum: 選択テキスト → POST）
- A10 menu bar widget（簡素な input → POST）
- U12-c フェードフィードバック

### Step 3（暗号化合意後）
- L1-c chain 別暗号化
- L2-b 検閲

→ ここまでで「capture 体験」の骨格が立つ。
A1/A3/A8/A9 等の重い投資はここから判断。

---

## このブレストの「決めなかったこと」総括

採否を決めなかった主要論点:

- 全 A1-A20 チャネル: どれを実装するか未決
- PP1-PP5 パイプライン: どれを採用するか未決
- C1-a〜d 3層分離: 推しはあるが確定せず
- L1-a〜d 暗号化範囲: vault 単位推奨だが要 policy 確定
- D6-a〜d ストア構造: staging 推しだが既存互換要検討

すべてユーザー（akaghef）が後で論点 ID 単位で選ぶ前提。

---

## 論点 ID 一覧（このファイル）

- M1. MVP チャネルセット
- M2. パイプライン最小構成
- M3. UI 最小実装
- M4. 暗号化 MVP 許容範囲
- M5. 段階ロードマップ
- M6. m3e-scratch 接続
- O1-O7. 横断観察
- Q1-Q10. 未決質問

---

## 全ファイル横断 論点 ID リスト

| ファイル | 論点 ID 範囲 |
|---|---|
| 01_concept | C1-C7 |
| 02_channels | A1-A20, S1-S5 |
| 03_processing_pipeline | P1-P14, PP1-PP5 |
| 04_runtime_ux | U1-U20 |
| 05_data_privacy | D1-D10, L1-L8 |
| 06_mvp_path | M1-M6, O1-O7, Q1-Q10 |

合計 ~110 論点。  
ユーザーは「論点 A3-c + P1-e + U19-d + L1-c で実装して」のように指定可能。
