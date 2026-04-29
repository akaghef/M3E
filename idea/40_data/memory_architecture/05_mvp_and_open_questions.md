# 05. MVP と未決質問

## M1. 着手優先度

ROI 順で 4 段：

### Wave 1 — 文書のみ（実装ゼロ、即効）
1. **D5 Read-path priority** を `canvas-protocol` / `CLAUDE.md` に追記
   → agent の Deep 質問が map に投げられるようになる
2. **D2 Settling Gate 条件** を Qn 運用ルールに追記
   → Qn の semantics が "Deep 昇格ゲート" に統一される

### Wave 2 — 軽い実装（半日〜1 日）
3. **付箋 MVP（B 案）** — ノードに `annotations[]` 属性追加、agent / CLI で書き読み
4. **Hermes I1（gateway scratch 入口）** — Discord/Telegram → /api/maps/ POST hook
5. **Tier A 予算ルール** — `~/.claude/memory/MEMORY.md` に index 200 行 / typed-memory 各 800 char の cap、超過警告

### Wave 3 — 中規模（数日）
6. **D1 Promote 一方向 + provenance 属性** — 昇格アクション実装、settled 属性
7. **D4 Demotion to archive** — Deep ノードの archive 移動フロー
8. **Hermes I2（cron janitor）** — sort-task / scratch 整理 / dead-link 検出を Hermes cron 化

### Wave 4 — 大規模（週単位）
9. **付箋 A 案進化** — 別 kind ノード、viewer side-pin、toggle UI
10. **D7 Privacy=Deep 境界** — encrypted 属性と Deep 属性の結合、private/public トップ分割
11. **D3 Mirror staleness 機構** — Hermes / ~/.claude/memory の refresh 機構

## M2. 主要な未決質問

### Q1. Deep の判定境界は単一属性で良いか？
- D2 Settling Gate (a)(b)(c) は OR 条件だが、UI 上は単一フラグ `deep: true` で表現するか
- 候補：単一フラグ + provenance テキストで根拠を残す（Hermes の memory entry に近い）
- 反論：(a)(b)(c) で **暗号化対象が変わる**（D7）なら、フラグだけでは足りない可能性

### Q2. Hermes の MEMORY.md に何を mirror するか？
- 全 axes / glossary / vision / 確定 PJ 仕様？
- 1300 token 制約があるので index 程度しか入らない
- 候補：Hermes 側 MEMORY.md は M3E map の **トップ階層 index のみ** mirror、
  詳細は session_search 相当の M3E REST 検索を Hermes tool で公開

### Q3. 付箋の "対象 Deep ノードに対する位置情報" は要るか？
- node 全体に付箋 vs node 本文の特定箇所に付箋
- 後者は実装重い（テキスト範囲指定）
- MVP はノード単位、将来テキスト範囲対応？

### Q4. agent 間の局所議論を付箋でやるか backlog でやるか？
- 付箋 = local、backlog = global
- 境界：「単一ノードに閉じる議論」は付箋、「複数ノード横断」は backlog
- 判定基準を明文化必要

### Q5. Tier A 予算の二系統分離は今の typed-memory 4 型と整合する？
- Hermes：MEMORY（環境・規約） vs USER（嗜好）の 2 系統
- M3E 現状：user / feedback / project / reference の 4 型、予算混合
- 候補 A：Hermes に倣い 2 系統（user vs それ以外）に圧縮
- 候補 B：4 型維持、各型に独立予算
- 候補 C：4 型維持、予算は user 系 vs ops 系の 2 グループに

### Q6. Hermes 統合時の prompt injection 防御層はどこに置く？
- Hermes gateway 側 security scan を信頼？
- M3E 側にも入力検閲（`ai_agent_deep/G3` L5）を入れる？
- 両層必要？片方で十分？

### Q7. Deep ノードが Qn を経ずに修正される必要があるケースは？
- 例：typo 修正、glossary 用語の rename、node 移動
- D6 Qn settling を例外なく適用すると硬直
- 例外条件の定義必要：cosmetic / structural reorganization は人間 explicit authorization で skip

## M3. 実験できる小ネタ

文書だけで進められるもの（まず手を動かす素振り）：

- **E1**：M3E 現状の map から axes / glossary / 確定 PJ ノードを列挙、
  これらが Deep ゾーンに該当することを確認
- **E2**：scratch 配下を読み、「局所化されてるべき = 付箋に移すべき」
  ノードと「未局所化のまま = scratch でよい」ノードを分類
- **E3**：~/.claude/memory/MEMORY.md の現サイズを測り、Wave 2-5 の cap で破綻するかを試算
- **E4**：直近 Qn のうち、`selected=yes` 後に Deep 昇格されたか実装上追跡できるかを検証

## M4. 関連ブレストへの波及

本ブレストの結論を採用すると影響が及ぶ既存ブレスト：

- `privacy_security/` — D7 で encryption boundary 仕様確定が必要
- `maintenance_hygiene/` — Wave 3 の demotion / archive アクション追加
- `ai_agent_deep/` — Hermes 統合で C10 自走 AI の前身が外部委譲化
- `keyboard_modes/` — M27/M28 に付箋作成 mode 追加検討
- `automation_obstacles/` — Hermes に出す処理は L3 自走の境界事例

## M5. やらない判断

- **本ブレストでは決めない**：
  - 採否（Wave 1 から始めるか全 Wave か）
  - 各属性の正確なスキーマ
  - Hermes への移植 skill の選定
  - viewer 描画の具体仕様
- **やらないかもしれない**：
  - Honcho / mem0 等の memory provider 統合（Hermes 経由で十分なら不要）
  - 付箋の音声入力（Hermes I1 でカバーできるなら）
  - Tier A 予算の自動 consolidate（人間 review 推奨、自動化は信頼蓄積後）

## キーメッセージ

- **Wave 1 は文書だけで効く**。即着手の価値あり
- 全 Wave 通すと M3E memory layer が Hermes 越えの設計になる
- 未決質問は **Q1（Deep 判定）と Q5（予算分離）** が一番効く、先に詰めたい
- 実装より先に、**E1〜E4 で現状把握**するのが安全
