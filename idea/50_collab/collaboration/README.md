# Collaboration — 協調・コラボレーション体験設計

複数人 / 複数エージェントで M3E マップを使う体験のブレインストーミング。
**研究者 akaghef が、共同研究者・査読者・指導教員・複数の AI subagent と
マップを介して同期/非同期に協働する** ためのチャネル設計を網羅的に並べる。

レビュー保留のため、各論点について **複数の選択肢を並べ、決定はしない**。
後で論点 ID 単位で選んで実装方針を確定する。

## 方針

- 採用判断はしない（候補は全て並列保持）
- 実装は考えない（コンセプトと体験設計に集中）
- 複数案を比較表で並べる
- automation_obstacles/05_m3e_strategy の **「やらないリスト」と整合**:
  Google Docs 級の完全協調エディタは範囲外（NM4）
- M3E のスコープは「ハブ役・非同期レビュー基盤・引き継ぎ場」に絞る方向を主軸に
- 3軸を意識: **人 ↔ 人** / **人 ↔ エージェント** / **エージェント ↔ エージェント**
- 既存実装（collab.ts / cloud_sync.ts / presence.ts / conflict_backup.ts）と接続

## ファイル構成

- [01_concept.md](01_concept.md) — 何を作るか・なぜ・誰が嬉しいか・ユースケース・既存ツール差分・「やらない」整合
- [02_axes_and_modes.md](02_axes_and_modes.md) — 3軸（人↔人 / 人↔エージェント / エージェント↔エージェント）× 同期/非同期 のモード列挙
- [03_runtime_ux.md](03_runtime_ux.md) — UI/操作系のバリエーション（プレゼンス・コメント・引き継ぎ・発言権）
- [04_data_permission.md](04_data_permission.md) — データモデル・権限モデル・ACL・プロビナンス・既存 collab.ts との整合
- [05_mvp_and_strategy.md](05_mvp_and_strategy.md) — MVP 候補・戦略選択・横断観察・未決質問

## 全体俯瞰 / 論点マップ

| 層 | 論点 | 扱うファイル |
|---|---|---|
| **Why** | Google Docs と何が違うか／何を狙うか | 01 |
| **Who/When** | 共同研究・査読・指導・並列 AI が「協調する」シーン | 01 |
| **Axis** | X1-X3: 3軸 × 同期/非同期 のモード | 02 |
| **UX** | U1-U18: プレゼンス・コメント・レビュー・引き継ぎ UI | 03 |
| **Permission** | P1-P10: ロール・ACL・スコープ | 04 |
| **Data** | D1-D8: コメント・履歴・引き継ぎログのスキーマ | 04 |
| **Strategy** | S1-S5: ハブ型/専用型/AI 中継型 | 05 |
| **MVP** | M1-M6: どこから始めるか | 05 |

## 論点一覧（早見表）

### Concept（01）
- Cn1. M3E の協調スコープを「ハブ役」に絞るか「軽量同編集」まで踏み込むか
- Cn2. 「協調エディタにならない」境界線はどこか（NM4 整合）
- Cn3. 想定ユーザー組（共著者/査読者/指導教員/班メンバ/エージェント群）
- Cn4. 「人間同士の協調」と「AI エージェント同士の協調」を同じ機構で扱うか分けるか
- Cn5. 成功指標（引き継ぎ漏れ削減 / レビュー往復短縮 / プレゼンス可視化満足度）

### Axes & Modes（02）
- X1. 人 ↔ 人（共著・指導・査読）
- X2. 人 ↔ エージェント（dispatch / handoff / review）
- X3. エージェント ↔ エージェント（visual/data/team の相互参照）
- M1-M6. 同期 / 非同期 / 半同期 の各モード切り口

### Runtime UX（03）
- U1. プレゼンス点表示（ノード端の小ドット）
- U2. プレゼンスリスト（サイドバー、誰が今どこ）
- U3. ライブカーソル / フォーカスハイライト
- U4. フォロー（他人の視点に追従）
- U5. 編集ハイライト（直近他者編集ノードの色付け）
- U6. コメント（ノード添付、Google Docs 風）
- U7. 注釈レイヤー（マップ上のフリー注釈）
- U8. スレッド議論（コメントへの返信）
- U9. 解決（resolve）/ 再オープン
- U10. レビュー依頼ボタン（ノード→人 or エージェント）
- U11. レビュー集約ビュー（自分宛/自分発の依頼一覧）
- U12. 発言権モード（プレゼンタ駆動／全員観覧）
- U13. ハンドオフ「投げる」UI（agent→human, human→agent）
- U14. ハンドオフ「受ける」UI（受信トレイ）
- U15. ロック表示（誰が編集中、ScopeLock 可視化）
- U16. 過去差分の overlay（誰がいつ何を変えた）
- U17. 通知（DM/メール/マップ内バッジ）
- U18. オフライン挙動と「再接続時の競合」UI

### Permission / Data（04）
- P1. ロール定義（owner/human/ai-supervised/ai/ai-readonly／既存 collab.ts と整合）
- P2. ノード単位 ACL の粒度（全マップ／subtree／単ノード／属性）
- P3. workspace 単位の権限分離
- P4. 共有リンク（read-only / comment-only / edit）
- P5. 招待モデル（メール / トークン / 知ってる人のみ）
- P6. 権限変更ログ
- P7. 「観覧専用」ゲスト（プレゼン用）
- P8. AI エージェントの権限（capabilities: read/write）の昇降格
- P9. 機微ノードの強制マスキング（policy_privacy 整合）
- P10. プロビナンス（誰の発言・誰の編集かを必ず残す）

- D1. コメントスキーマ（id/作者/時刻/対象ノード/状態/スレッド）
- D2. レビュー依頼スキーマ（依頼者/受領者/期限/状態/結果）
- D3. ハンドオフログスキーマ（agent ↔ human の引き継ぎ trail）
- D4. プレゼンスデータの保存粒度（揮発 vs 永続）
- D5. ロックの保存（ScopeLock 既存と整合）
- D6. 通知キューデータ
- D7. 監査ログとの統合（audit_log 既存）
- D8. コンフリクト時のバックアップ（conflict_backup 既存）

### Strategy / MVP（05）
- S1. ハブ型戦略（M3E は協調 SaaS にならず、外部ツールと連携の中心）
- S2. 非同期レビュー特化戦略（Google Docs と競合せず差別化）
- S3. AI 中継特化戦略（agent ↔ human の引き継ぎ場として極める）
- S4. 軽量同期戦略（プレゼンス + ロックだけ、編集は逐次反映）
- S5. プレゼンテーション特化（発言権モード / フォローを主役に）

- M1. プレゼンス + ロック表示の最小実装
- M2. ノード添付コメント + 解決
- M3. レビュー依頼 → 受信トレイ
- M4. ハンドオフ trail（agent ↔ human）
- M5. 招待・共有リンク（read-only から）
- M6. 既存 subagent ワークフロー（visual/data/team）への適用

## キーメッセージ（仮置き）

1. **「協調」を一枚の機能として作らず、軸ごとに別 UI として切り出す** —
   人↔人と人↔AI と AI↔AI は要件が大きく違う。一画面に詰め込むと過密になる。
2. **「ハブ役」「非同期レビュー基盤」が M3E の差別化軸** — Google Docs と同じ土俵で戦わない。
   automation_obstacles/05 の NM4「Google Docs 級の協調エディタはやらない」と整合。
3. **既存 collab.ts / presence.ts は既に骨格を持つ** — 完全な書き直しではなく、UX 層と
   ハンドオフ trail の追加が現実的。
4. **agent ↔ human の引き継ぎ UI が弱点** — 現状は dev-docs / TODO に散る。
   M3E マップ上で「投げて受ける」フローが作れれば dogfood 価値が高い。
5. **発言権モード（U12）はプレゼン用と「集中ファシリ用」両用** — 個人作業時に
   「俺だけ操作」というモード切替も同じ機構で実現できる可能性。

## 関連 idea/ クロスリンク

- `idea/automation_obstacles/05_m3e_strategy.md` — NM4 / F1〜F5 / 役割1ハブ
- `idea/capture_ingest/README.md` — 取り込み後の triage を協調レビューに繋ぐ
- `idea/keyboard_modes/` — Review mode / Comment mode のキー設計余地
- `idea/map_views/` — Presence view / Review queue view の候補
- `idea/00_topic_pool.md` — E1-E7（本ブレストの起点）

## 既存メモリ・実装との接続

- `project_overview` — 研究思考支援。共同研究の現場でも使う前提
- `policy_privacy` — クライアント暗号化必須。共有時のマスキング義務
- `feedback_dev_map_size` — DEV map 50-300。協調状態が肥大化したら scope 切替
- `feedback_agent_status_routine` — Agent Status 更新習慣 = 既に簡易 handoff
- `project_alglibmove_dogfood` — 認知層の不足。協調こそ認知層の試金石
- `beta/src/node/collab.ts` — entity / role / ScopeLock / SSE 既存
- `beta/src/node/presence.ts` — mapId × entityId のプレゼンス揮発状態
- `beta/src/node/cloud_sync.ts` — クラウド経路（招待・共有の基盤候補）
- `beta/src/node/conflict_backup.ts` — 競合時の自動退避
