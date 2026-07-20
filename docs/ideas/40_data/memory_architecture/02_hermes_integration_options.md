# 02. Hermes 統合オプション — 揮発の外部委譲

M3E が Deep 正本に専念するため、Flash/Rapid 揮発レイヤを Hermes に委譲する 3 パターン。

## I1. Gateway scratch 入口（最 ROI）

Hermes gateway の Discord / Telegram / Email 受信 → hook で `/api/maps/` POST → scratch ノード化。

- 移動中・寝床から思いつきを map に投入できる
- privacy 上 scratch は public cone なので暗号化不要
- voice memo → 文字起こし → scratch も同じ径路で実装可

実装規模：1 日。Hermes hook + M3E REST 既存。

論点：
- 入力検閲（prompt injection 耐性）— Hermes 側 security scan を信頼するか
- 重複投入の dedupe — Hermes 側？M3E 側？
- どの map / どの scratch カテゴリに落ちるか — sender ごとに固定 vs LLM 分類
- 投入レート制限（暴走防止）

## I2. Cron janitor（人手節約）

Hermes cron で定期メンテを agent 不在時間に実行：

- 朝 sort-task 相当（DAG 再計算）
- scratch カテゴリ整理 / overflow 検出
- dead-link / orphan ノード検出
- daily snapshot（map JSON）
- 週次 archive promotion

実装規模：cron 設計 + Hermes 側 skill 移植。3-5 日。

論点：
- 権限境界 — read-only / proposal-only / write-with-undo（ai_agent_deep H8）
- 失敗時の挙動（cron 失敗ログをどこに）
- 朝の "夜のうちにこれをしました" 報告（C10 自走 AI と同形式）
- N1 思考の核心ゾーンに触れさせない仕組み（D7 Privacy=Deep 境界と整合）

## I3. Heavy worker（重処理外出し）

時間のかかる skill を Hermes 側で走らせ、結果を map サブツリーに書き戻す：

- `pdf-raw-process`（論文 PDF を構造化、theorems.json / figures SVG 抽出）
- `web-search`（Tavily / Exa での外部リサーチ）
- 大きな LLM 推論（multi-step research）
- `claude-api` での高コスト処理

実装規模：skill ごとに移植 + 書き戻し I/F。長期。

論点：
- M3E の skill と Hermes の skill が分裂する（二重保守）
- 結果ノードのスキーマ統一（provenance / 確信度 / 引用）
- 暗号化対象（Deep）には書き戻さない、scratch 直下に置いて Qn settling を経て Deep 化

## I4. 二重正本リスクと原則

**M3E = canonical, Hermes = 揮発ワーカー** を運用原則として固定する必要がある。

具体的には：
- Hermes の MEMORY.md / USER.md は M3E map の **read-only mirror**（D3）
- Hermes session_search（SQLite）は揮発、Deep の代用にしない
- Deep 質問は agent 側で **必ず map に投げる**（D5 read-path）

これがないと、Hermes 側でだけ覚えてた事実が session reset で失われ、
"先週 Hermes に話したよね？" が成立しない事故が起きる。

## I5. Sensitive cone の線引き

Hermes は外部 API キー保持・gateway 経由でメッセージ流出可能性。
**Deep ゾーンの sensitive subtree は Hermes に流さない**。

機械的に線を引く方法：
- D7 Privacy=Deep 境界の延長で、暗号化対象 = Hermes 不可視
- map の `public/` `private/` トップレベル分割
- Hermes 側の API は public 配下のみ参照可能なエンドポイントを別に切る

→ `privacy_security/05_vault_separation.md` と統合議論必要。

## 代替案

**alt I-skip**：Hermes 統合を一切せず、M3E 内ですべて完結
- pro：二重保守なし、privacy リスクなし
- con：揮発レイヤが Tier A に侵食し続ける（現状）、外出先入力できない

**alt I-mcp**：Hermes ではなく M3E 自前 MCP サーバを立て、Claude Code 等から呼ぶ
- pro：依存ベンダ減
- con：gateway / cron / heavy worker を全部自作することになる

→ Hermes 既存資産を借りる方が安い。MCP との両立は将来検討。

## 観察

- I1 だけでも入れる価値が大きい（外出先入力チャネルの不在を解決）
- I2 の cron は **権限設計が肝**、L1〜L2（提案のみ）から始めるべき
- I3 は **skill を持つ場所** の根本論点、片方に寄せるか並列保守か決断必要
- 三つとも **Deep に直接書かない** が共通制約（D6 Qn settling 経由必須）
