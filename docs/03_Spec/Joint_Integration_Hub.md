# Joint Integration Hub — リマインダー & 外部サービス共通連携層

最終更新: 2026-04-22
status: plan（実装前。Phase 0 = 仕様確定）

## 完了ステータス（at-a-glance）

採用プラン: **Plan 1（A-small + C ハイブリッド）** — 2026-04-22 確定（§5.5）

| Phase | 名前 | 状態 | 進捗 | 備考 |
|-------|------|------|------|------|
| 0 | 仕様確定 | in_progress | 3/4 | doc + Glossary + joint.ts skeleton 完了 / Q 起票 残（M3E map 起動時） |
| 1 | OS scheduler + m3e-notify CLI | not_started | 0/7 | 終了中発火を成立させる最小構成 |
| 2 | stale / recurring + ICS | not_started | 0/5 | UC-R1/R3/R4/R8 |
| 3 | Slack / Email channel | not_started | 0/6 | UC-R2、keychain 統合 |
| 4 | GCal outbound mirror（C 軸）| not_started | 0/4 | UC-R7、モバイル冗長化 |
| 5 | Todoist / Apple Rem 双方向 | not_started | 0/4 | UC-R6 |
| 6 | webhook receiver mode | conditional | 0/4 | UC-R5 需要顕在時に Plan 2 部分昇格 |
| 7 | 拡張・plugin 化 | conditional | 0/3 | adapter ≥ 4 で再評価 |

**Adapter 実装ステータス**

| カテゴリ | 候補数 | 実装済 | 残 |
|----------|--------|--------|----|
| Calendar (C1–C5) | 5 | 0 | 5 |
| Todo (T1–T5) | 5 | 0 | 5 |
| Issue tracker (I1–I5) | 5 | 0 | 5 |
| Notification channel (N1–N8) | 8 | 0 | 8 |
| Trigger source (Tr1–Tr4) | 4 | 0 | 4 |
| 合計 | 27 | 0 | 27 |

**Open Questions ステータス**

| Q | 暫定解 | 確定 |
|---|--------|------|
| Q1 reminder の格納先 | attribute + scheduler index | ☐ |
| Q2 stale 通知の所属 | reminder の 1 trigger kind | ☐ |
| Q3 双方向削除挙動 | two-way 時 dialog | ☐ |
| Q4 plugin 化閾値 | 3〜4 adapter 後に再評価 | ☐ |
| Q5 rate limit / dedup | adapter 別 cap + 同 rule dedup | ☐ |
| Q6 マルチアカウント | `<service>:<label>` 多重登録 | ☐ |
| Q7 休息日スキップ | workspace 休息日リスト | ☐ |

更新ルール: Phase 内 task の `[ ]` を `[x]` にしたら、本表の進捗欄も同期する。

## 0. 目的と一言要約

**Map ─ joint ─ 各種サービス** という単一の図式で、
リマインダーをはじめとする「ノードと外部サービスの通信」を**全部同じ層に集約**する。

リマインダー機能は joint の最初の応用であり、
joint を独立に設計することで Calendar / Todo / 通知チャネル / Issue tracker
を後から横並びに増やせる。

```
[Map (node attribute / scope rule)]
            │
            │  intent: schedule / fetch / push / notify
            ▼
       [Joint Hub]
            │
   ┌────────┼────────┬─────────┬──────────┐
   ▼        ▼        ▼         ▼          ▼
 Calendar  Todo   Notify    Issue     Webhook
 adapter   adapter adapter   adapter   adapter
   │        │        │         │          │
 GCal /   Todoist /  OS /     Linear /   IFTTT /
 ICS /    Apple Rem  Slack /  Jira /     Zapier
 Outlook            Email     Notion
```

本文書は以下を集約する:

1. リマインダーに関する idea/ の散在アイデアの集約
2. Map ↔ 外部サービスの**共通アダプタ規約**（joint）
3. 連携先サービスの**列挙**（カテゴリ別）
4. Phase 別実装計画（MVP → 段階拡張）
5. Glossary 追加候補・Open Questions

集約元（重複は省略）:
- [idea/10_io/tool_integration/01_concept.md](../../idea/10_io/tool_integration/01_concept.md) — 統合の三類型 / UC1〜UC7
- [idea/10_io/tool_integration/04_workflow_tools.md](../../idea/10_io/tool_integration/04_workflow_tools.md) — H2 Calendar / H7 Notion・Linear・Jira
- [idea/10_io/tool_integration/06_integration_patterns.md](../../idea/10_io/tool_integration/06_integration_patterns.md) — P1〜P4 統合4パターン / 共通インフラ案
- [idea/10_io/capture_ingest/02_channels.md](../../idea/10_io/capture_ingest/02_channels.md) — A12 Calendar / A15 webhook / A19 リマインダー Todo 統合
- [idea/60_workflow/personal_productivity/02_ritual_options.md](../../idea/60_workflow/personal_productivity/02_ritual_options.md) — 朝/昼/夜 ritual の発動方法
- [idea/30_ux/gamification/02_streak_and_badge.md](../../idea/30_ux/gamification/02_streak_and_badge.md) — K1.4 通知強度 / K1.6 健全な逸脱
- [idea/70_concept/philosophical/01_unfinished_principle.md](../../idea/70_concept/philosophical/01_unfinished_principle.md) — Uf4.b 30 日 nudge / Uf4.d 起動時提案

参照する既存 spec:
- [docs/01_Vision/Axes.md](../01_Vision/Axes.md) — 帯域別の外部接続（Flash/Rapid/Deep）
- [docs/03_Spec/AI_Common_API.md](AI_Common_API.md) — provider 非依存の共通 API 規約（joint も同じ流儀）
- [docs/03_Spec/Cloud_Sync_Conflict_Resolution.md](Cloud_Sync_Conflict_Resolution.md) — 衝突解決の既存ポリシー
- `memory/policy_privacy.md` — 機微情報送信禁止の絶対則

---

## 1. 連携サービス列挙（joint adapter 候補）

joint は「ノードと外部の間を取り持つアダプタ」。
以下は **adapter として実装する候補サービスの全体像**。
リマインダー文脈と非リマインダー文脈の両方を含む（統合インフラとして共通化するため）。

### 1.1 時間軸サービス（Calendar / Time）

| ID | サービス | 認証 | API | リマインダー関与 | 初期波 |
|----|----------|------|------|------------------|--------|
| C1 | ICS file import | 不要 | ファイル監視 | 受信のみ | ★ Phase 1 |
| C2 | Google Calendar | OAuth 2.0 | REST + push webhook | 双方向 | ★ Phase 2 |
| C3 | Outlook / MS Graph | OAuth 2.0 | REST | 双方向 | Phase 4 |
| C4 | Apple Calendar | iCloud / CalDAV | CalDAV | 双方向 | Phase 4 |
| C5 | CalDAV 汎用 (Fastmail/Proton) | Basic | CalDAV | 双方向 | 後 |

### 1.2 タスク / リマインダー専用サービス

| ID | サービス | 認証 | リマインダー関与 | 初期波 |
|----|----------|------|------------------|--------|
| T1 | Apple Reminders | EventKit (macOS local) | 双方向 | Phase 3 |
| T2 | Todoist | OAuth / API token | 双方向 | Phase 3 |
| T3 | Things | URL scheme + AppleScript | 送信寄り | 後 |
| T4 | Microsoft To Do | MS Graph | 双方向 | 後 |
| T5 | Google Tasks | OAuth | 双方向 | 後 |

### 1.3 Issue / PJ tracker（締切と紐付くタスク源）

| ID | サービス | 認証 | リマインダー関与 | 初期波 |
|----|----------|------|------------------|--------|
| I1 | Linear | OAuth / PAT, GraphQL | due_date 受信 | Phase 4 |
| I2 | Jira | PAT / OAuth, REST | due_date 受信 | 後 |
| I3 | Notion | OAuth, Block API | date 受信 | 後 |
| I4 | Asana | PAT, REST | 後 | 後 |
| I5 | GitHub Issue / PR | PAT, REST + webhook | review reminder | Phase 5 |

### 1.4 通知チャネル（M3E → ユーザに届ける出口）

| ID | チャネル | 認証 | 即時性 | 静音性 | 初期波 |
|----|----------|------|--------|--------|--------|
| N1 | OS native (macOS NC / Win Toast / libnotify) | 不要 | 高 | 中 | ★ Phase 1 |
| N2 | M3E アプリ内バナー | 不要 | 起動中のみ | 高 | ★ Phase 1 |
| N3 | Email (SMTP) | パスワード/OAuth | 中 | 高 | Phase 3 |
| N4 | Slack DM / channel | bot token | 中 | 中 | Phase 3 |
| N5 | Discord webhook / bot | token | 中 | 中 | Phase 3 |
| N6 | LINE Notify / Messaging API | token | 中 | 中 | Phase 4 |
| N7 | Telegram bot | token | 中 | 中 | 後 |
| N8 | iOS / Android push | APNs / FCM | 高 | 中 | 後（モバイル app 後） |

### 1.5 トリガー源 / 外部発火

| ID | トリガー | 用途 | 初期波 |
|----|----------|------|--------|
| Tr1 | 内蔵 scheduler (M3E node) | 時刻 / cron / RRULE | ★ Phase 1 |
| Tr2 | OS scheduler (cron / launchd / Task Scheduler) | M3E 終了時の発火保証 | Phase 2 |
| Tr3 | Calendar push webhook (C2 など) | 予定変更の即反映 | Phase 2 |
| Tr4 | IFTTT / Zapier / Make webhook | 任意外部条件 | Phase 5 |

### 1.6 認証 / シークレット保管

| ID | 保管先 | 安全 | 利便 | 既定 |
|----|--------|------|------|------|
| K1 | OS keychain (Keychain / Credential Manager) | 高 | 中 | ★ 既定 |
| K2 | M3E 暗号化 vault | 中 | 高 | フォールバック |
| K3 | env var | 低 | 高 | dev のみ |
| K4 | 平文 config | 禁止 | - | - |

→ `policy_privacy.md` 準拠。**機密マークノード由来の reminder は外部チャネル送信禁止**。

---

## 2. Joint 層の設計（共通アダプタ規約）

### 2.1 アダプタ契約（service 横断で同一）

`AI_Common_API.md` の流儀（browser は localhost Node API のみを叩く・provider 差は server で吸収）を joint にもそのまま適用する。

```ts
interface JointAdapter {
  id: string                     // "gcal" / "todoist" / "slack" / "os-notify"
  kind: 'source' | 'sink' | 'both'
  capabilities: {
    fetch?:  true   // 外部 → M3E
    push?:   true   // M3E → 外部 (mutate)
    notify?: true   // M3E → ユーザ (channel)
    webhook?: true  // 外部 → M3E (push 通知受け)
  }
  fetch?(scope: ScopeRef, since?: Timestamp): Promise<NormalizedEvent[]>
  push?(intent: PushIntent): Promise<PushResult>
  notify?(payload: NotifyPayload): Promise<NotifyResult>
  webhook?(req: WebhookReq): Promise<void>
  schema: AttributeSchema       // この adapter が node に書く attribute の型
}
```

3 つの I/O 種別を 1 契約に集約する点がポイント:
- **fetch / push** = 同期（データを動かす）
- **notify** = 通知（人に伝える）
- **webhook** = 受信（外部発のイベント）

### 2.2 共通 endpoint（node API）

```
GET  /api/joint/status                       # adapter 一覧と状態
POST /api/joint/:adapter/fetch               # pull 実行
POST /api/joint/:adapter/push                # push 実行
POST /api/joint/:adapter/notify              # 通知送出
POST /api/joint/webhook/:adapter             # 外部 webhook 受け口
GET  /api/joint/reminder                     # 全 reminder rule 一覧
POST /api/joint/reminder                     # rule CRUD
POST /api/joint/test/:adapter                # dry-run
```

### 2.3 共通スキーマ — `NormalizedEvent`（adapter 横断の正規形）

```jsonc
{
  "source": "gcal",                    // adapter id
  "external_id": "abc123",
  "kind": "event" | "task" | "reminder" | "issue",
  "title": "...",
  "body": "...",
  "starts_at": "ISO8601",
  "ends_at": "ISO8601",
  "due_at": "ISO8601",
  "rrule": "FREQ=DAILY;BYHOUR=9",      // 繰り返し（任意）
  "status": "open" | "done" | "cancelled",
  "url": "https://...",
  "tags": ["..."],
  "raw": { /* adapter 固有データ */ }
}
```

すべての adapter は fetch 結果をこの形に**正規化してから**返す。

### 2.4 ID 戦略 — `external.<service>.<id>`（idea/10_io/06 §6.2.1 採用）

ノード attribute で外部 ID を保持する：

```jsonc
"attributes": {
  "external": {
    "gcal":     { "event_id": "...", "url": "https://..." },
    "todoist":  { "task_id": "..." },
    "linear":   { "issue_id": "..." }
  },
  "reminder": { /* §3 参照 */ }
}
```

mapping table 方式（別ファイル）も将来オプションとして残すが、**MVP は attribute 方式**。

### 2.5 同期パイプライン（4 工程の共通化）

```
[外部] → fetch → normalize → diff → apply → [M3E]
[M3E] → diff  → normalize → push → [外部]
```

`fetch` / `normalize` / `push` は adapter 実装、
`diff` / `apply` / `conflict` は joint 共通（既存 `Cloud_Sync_Conflict_Resolution` と同じ流儀）。

### 2.6 トリガー種別（reminder の起動条件）

| kind | 説明 | 例 |
|------|------|-----|
| `absolute` | 絶対時刻 | 2026-04-25T14:00 |
| `relative` | 起点からの相対 | due の 60 分前 |
| `recurring` | RRULE | 平日 09:00 |
| `stale` | 一定期間未更新 | 30 日触ってない（Uf4.b） |
| `event` | 外部イベント | GCal event 開始（C2） |
| `manual` | 起動時 prompt | 朝チェックイン（A1-δ） |

### 2.7 プライバシーゲート（送出前の必須通過点）

joint からの **outbound 全て**（push / notify）は以下を順に通過する：

1. ノードの暗号化フラグ確認 → encrypt 対象は send 拒否（`policy_privacy`）
2. workspace の private 指定確認
3. ノードの `public_safe` フラグ
4. adapter の許可リスト
5. 自動 mask（メアド・電話番号 regex）
6. dry-run preview（任意）

失敗時は **fail-closed**（送らない＋ノードに警告 attribute）。

### 2.8 オフライン耐性

- 失敗を queue に積む（既存 `conflict_backup` と統合）
- 接続回復で自動再試行
- N 回連続失敗で adapter を `degraded` 状態に、UI で可視化

---

## 3. リマインダーのデータモデル（node 上）

```jsonc
"attributes": {
  "reminder": {
    "rules": [
      {
        "id": "r1",
        "trigger": { "kind": "absolute", "at": "2026-04-25T14:00+09:00" },
        "channel": ["os", "slack:#study"],
        "lead_min": 0,
        "snooze_min": [10, 30, 60],
        "until": "2026-05-01T00:00Z",
        "muted": false
      },
      {
        "id": "r2",
        "trigger": { "kind": "relative", "from": "due", "delta_min": -60 },
        "channel": ["os"]
      },
      {
        "id": "r3",
        "trigger": { "kind": "recurring", "rrule": "FREQ=WEEKLY;BYDAY=FR;BYHOUR=17" },
        "channel": ["banner"],
        "label": "週次レビュー nudge"
      },
      {
        "id": "r4",
        "trigger": { "kind": "stale", "no_touch_days": 30 },
        "channel": ["banner"],
        "label": "Uf4.b 探索停滞 nudge"
      }
    ],
    "external_sync": {
      "gcal":    { "event_id": "...", "direction": "two-way" },
      "todoist": { "task_id": "...",  "direction": "in-only" }
    },
    "history": [
      { "rule": "r1", "fired_at": "...", "channel": "os", "result": "ok" }
    ]
  }
}
```

設計判断:
- **rules は配列**: 1 ノードに複数 reminder が普通に乗る
- **channel は文字列配列**: `os` / `banner` / `slack:#chan` / `email:foo@bar` のような adapter id ベース
- **history はノード内に格納**: 振り返り（personal_productivity G2）と地続き
- **external_sync は方向別に持つ**: in-only / out-only / two-way
- **stale は reminder の一形態**: 「未完成原則 Uf4.b」と「ストリーク K1.6」を同じ機構で扱える

---

## 4. ユースケース（このシステムで成立するもの）

### 4.0 UC-R0 — primary UC「triage 中の日付付与で reminder が裏で立つ」

Plan 1 を駆動する**第一級ユースケース**。Phase 1 の実装はこの UC を成立させることを目的とする。

#### 骨子

```
ユーザー: マップで task を整理中
  → ノードに日付を書く
  → 「リマインド」をトリガー
  → (透過) reminder rule 生成 + OS scheduler 登録 + 視覚フィードバック
```

#### サブ論点（採否未定。ユーザー選定待ち）

| 軸 | 候補 | 推し（参考） |
|----|------|--------------|
| **A. 日付の書き方** | A1 本文直書き / A2 属性 picker / A3 自然言語 / A4 hybrid（本文 → 不在時 picker）| A4 |
| **B. トリガー方法** | B1 ショートカット / B2 コマンドパレット / B3 右クリック / B4 日付検出時 auto prompt / B5 属性パネルトグル / B6 ゼロクリック自動 | B1 |
| **C. channel 決定** | C1 既定 OS 通知のみ / C2 毎回 dialog / C3 workspace 既定 + override | C1 |
| **D. リマインド時刻** | D1 ピッタリ / D2 N 分前（既定 15 分） / D3 当日朝にまとめ / D4 D1+D2 多段 | D2 |
| **E. 視覚フィードバック** | E1 🔔 アイコン（Freeplane 流） / E2 時計 + 残時間 tooltip / E3 silent | E1 |
| **F. 重複・更新挙動** | F1 上書き（createOrReplace 流）/ F2 配列追加（複数化）/ F3 dialog で選択 | F3 |

**推し選定根拠**:
- A4: 速く書ける × UI でも直せる
- B1: keyboard 中心の研究者ワークフロー整合
- C1: 最小摩擦（Plan 1 既定の OS native 通知のみで十分）
- D2: 実用上「ピッタリ」は遅すぎる（移動・準備時間ゼロ）
- E1: Freeplane 既存 UX に慣れているユーザー多
- F3: 破壊的変更（既存 reminder の上書き）を防ぐ

#### Phase 1 への影響

UC-R0 が確定すると Phase 1 タスク（§5）は次のように具体化される:
- A 確定 → 日付 parser or picker UI のどちらが必要か決まる
- B 確定 → keybinding 登録 / コマンド ID / メニュー項目のどこに実装するか決まる
- C 確定 → channel 選択 UI が要るか不要か決まる
- D 確定 → scheduler の lead_min 既定値が決まる
- E 確定 → ノード描画への変更箇所が決まる
- F 確定 → トリガーハンドラの分岐構造が決まる

→ **A〜F の選定は Phase 1 着手前のブロッカー**。

### 4.1 派生ユースケース（リマインダー文脈の主要ケース）

| UC | シーン | 使う adapter | trigger kind |
|----|--------|--------------|--------------|
| UC-R1 | 「明日 14:00 指導会」ノードに reminder | N1 OS | absolute |
| UC-R2 | 投稿締切 1 時間前に通知 | N1 + N4 Slack | relative (from due) |
| UC-R3 | 毎朝 9:00 に「今日の一手」prompt | N2 banner | recurring |
| UC-R4 | 30 日触っていない subtree を探索停滞 nudge | N2 banner | stale |
| UC-R5 | GCal の予定変更が M3E ノードに即反映 | C2 webhook | event |
| UC-R6 | Todoist のタスク完了が M3E ノード status を更新 | T2 fetch | event |
| UC-R7 | M3E で reminder 設定 → GCal にも event 作成 | C2 push | absolute |
| UC-R8 | 起動時に「未完成を 1 つ書きませんか」prompt | (内蔵) | manual |

---

## 5. Phase 別実装計画（Plan 1 採用版）

「OS scheduler 抽象化を先にやる、OAuth は後回し、daemon 化は最後の手段」が骨子。

### Phase 0 — 仕様確定（本ドキュメント）

- [x] このドキュメント作成
- [x] Glossary に `joint`, `adapter`, `channel`, `reminder`, `nudge`, `m3e-notify` を追加
- [x] `beta/src/node/joint.ts` 雛形（registry + 型定義）作成・型チェック通過
- [ ] reviews/Qn に Open Questions（§7）を起票（M3E map 起動時）

### Phase 1 — OS scheduler + m3e-notify CLI 雛形（auth 不要）

- [ ] OS scheduler 抽象化（cron / launchd / Task Scheduler を 1 API で）
- [ ] `m3e-notify` CLI 雛形（rule id を引数で受け、SQLite 読んで発火）
- [ ] joint registry（adapter 動的登録）
- [ ] OS native 通知 adapter（N1）
- [ ] M3E アプリ内バナー adapter（N2）
- [ ] node attribute `reminder.rules` 編集 UI（最小）
- [ ] dry-run プレビュー
- [ ] **完了基準**: M3E 終了中でも、設定した時刻に OS 通知が鳴る

### Phase 2 — stale / recurring 完全実装 + ICS

- [ ] 内蔵 scheduler（absolute / relative / recurring / stale / manual の 5 kind）
- [ ] CLI から SQLite read-only scan で stale 検知
- [ ] RRULE パーサ（recurring）
- [ ] ICS file import adapter（C1, source-only, file watch）
- [ ] 起動時 prompt（manual trigger, UC-R8）
- [ ] **完了基準**: UC-R1 / UC-R3 / UC-R4 / UC-R8 が成立

### Phase 3 — Slack / Email channel（CLI から呼ぶ）

- [ ] OS keychain 連携（K1）
- [ ] Email (N3) adapter
- [ ] Slack (N4) adapter
- [ ] Discord (N5) adapter
- [ ] mute / snooze / lead_min の完全実装
- [ ] reminder 履歴ビュー
- [ ] **完了基準**: UC-R2 が成立

### Phase 4 — GCal 外部 mirror（C 軸 outbound）

- [ ] OAuth flow runner（共通化）
- [ ] Google Calendar adapter（C2, push のみ）
- [ ] external_sync の outbound mirror 実装
- [ ] direction === 'two-way' 時の確認 dialog（Q3 暫定解）
- [ ] **完了基準**: UC-R7 が成立、モバイルでも GCal 経由で鳴る

### Phase 5 — Todoist / Apple Reminders 双方向

- [ ] Apple Reminders adapter（T1, macOS EventKit）
- [ ] Todoist adapter（T2）
- [ ] external_sync の two-way 実装
- [ ] adapter 別フィルタビュー
- [ ] **完了基準**: UC-R6 が成立

### Phase 6 — webhook receiver mode（Plan 1 → Plan 2 部分昇格）

UC-R5 の需要が顕在化した時点で実施。

- [ ] M3E node の "webhook receiver mode" 常駐起動オプション
- [ ] GCal push notification webhook 受信
- [ ] Outlook (C3) / Apple Cal (C4) / LINE (N6) adapter
- [ ] Linear adapter（I1, due_date 取り込み）
- [ ] **完了基準**: UC-R5 が成立、外部の予定変更が即時 M3E に反映

### Phase 7 — 拡張点（plugin 化検討）

- [ ] webhook 汎用（Tr4, IFTTT/Zapier）
- [ ] GitHub Issue/PR adapter（I5）
- [ ] joint plugin API 抽出判断（adapter 数 ≥ 4 の時点で再評価、Q4）

---

## 5.5 実装プラン候補（フル計画・上位順）

「サーバ常駐前提か」「外部委譲するか」で大きく 3 通りに分かれる。
**Plan 1 採用（2026-04-22 確定）**。Plan 2/3 は将来再評価候補、Plan D（"起動中のみ" 明記して諦める）は保留（Freeplane と同等止まり）。

§5 の Phase 計画は Plan 1 の Phase 内訳で再構成済み（下記）。

---

### Plan 1 — A-small + C ハイブリッド（推奨）

**構成**: 小型 CLI `m3e-notify` を作り、OS scheduler 経由で発火。重要 reminder は GCal にも複製して外部冗長化。

```
[M3E node 起動中] rule 編集 → OS scheduler に entry 書込
                        ↓
                  [m3e-notify CLI]   ← OS scheduler が時刻に呼ぶ（M3E 終了中も）
                        ↓
                  read SQLite → policy gate → channel dispatch
                        ↓
              [OS 通知 / Slack / Email / banner キュー]

[並行] 重要 rule のみ → GCal/Todoist にも mirror（C 軸）
                        ↓
                外部サービス側でも独立に通知（モバイルでも鳴る）
```

**Phase 計画**

| Ph | 中身 | 完了基準 |
|----|------|----------|
| 1 | OS scheduler 抽象化（cron/launchd/Task Scheduler）+ m3e-notify CLI 雛形 + OS 通知 adapter + banner | M3E 終了中に reminder が OS 通知として鳴る |
| 2 | stale 検知（CLI から SQLite read-only scan）+ recurring 完全実装 + ICS import | UC-R1/R3/R4 が成立 |
| 3 | OS keychain + Slack/Email adapter（CLI から呼ぶ） | UC-R2 成立 |
| 4 | GCal OAuth + outbound mirror（C 軸、push のみ） | UC-R7 成立、モバイルでも鳴る |
| 5 | Todoist / Apple Reminders の双方向 fetch | UC-R6 成立 |
| 6 | webhook 受信が必要になった時点で B daemon を「webhook receiver mode」だけ追加 | UC-R5 成立 |

**カバー UC**: R1 / R2 / R3 / R4 / R6 / R7 ◎ ／ R5 は Ph6 まで保留

**弱点**
- CLI cold start ~50–200ms × rule 数（数十 rule なら無視可、数千 rule なら問題）
- 3 OS の scheduler 抽象化が小さくない実装負債（cron syntax / launchd plist / Task Scheduler XML）
- Plan 2 と違い「webhook 即反映」が遅れる（GCal 側の 5 分 poll 等で代替）

**採用キー**: 「常駐は嫌だが、M3E 終了中も鳴ってほしい」「モバイルでも鳴ってほしい予定がある」

---

### Plan 2 — B 常駐デーモン全部入り

**構成**: M3E node を system tray 常駐の daemon にして、全 trigger を内蔵 scheduler で処理。webhook も内蔵で受ける。

```
[M3E daemon (常駐)]
       ├─ 内蔵 scheduler（全 trigger 種）
       ├─ webhook receiver（HTTP server）
       ├─ adapter registry（fetch/push/notify を直接呼ぶ）
       └─ tray icon（quick-add も兼ねる）
              ↓
        [全 channel adapter]
```

**Phase 計画**

| Ph | 中身 | 完了基準 |
|----|------|----------|
| 1 | tray 常駐モード化 + autostart 設定 + 内蔵 scheduler + OS 通知 + banner | tray から reminder 鳴る、PC 起動で自動立ち上げ |
| 2 | GCal OAuth + webhook receiver + Calendar 双方向 | UC-R5/R7 成立 |
| 3 | Slack / Email / Discord channel | UC-R2 成立 |
| 4 | Todoist / Apple Rem / Linear / Outlook | UC-R6 成立 |
| 5 | plugin API 抽出 | adapter を外部 npm 化可能 |

**カバー UC**: 全 UC ◎（最初から R5 もいける）

**弱点**
- 常駐メモリ ~150–300MB が研究者ノート PC で嫌われる
- バッテリ消費・thermal
- autostart の OS 別実装（plist / Run key / .desktop）
- ユーザに「daemon として動いている」概念を強いる
- crash した時の reminder 完全停止リスク（Plan 1 は OS scheduler が独立して動く）

**採用キー**: 「M3E をリサーチワークスペースの hub にする覚悟」「webhook が初日から欲しい」「モバイル不要」

---

### Plan 3 — A-small 単独（外部 OAuth ゼロ）

**構成**: Plan 1 から C 軸（GCal mirror）を削った版。OS scheduler + CLI のみ、外部クラウドサービスへの依存ゼロ。

```
[M3E node 起動中] rule 編集 → OS scheduler に entry 書込
                        ↓
                  [m3e-notify CLI]  ← OS scheduler が時刻に呼ぶ
                        ↓
              [OS 通知 / banner / Slack / Email]
```

**Phase 計画**

| Ph | 中身 | 完了基準 |
|----|------|----------|
| 1 | OS scheduler 抽象化 + m3e-notify CLI + OS 通知 + banner | UC-R1 成立 |
| 2 | stale 検知 + recurring + 起動時 prompt | UC-R3/R4/R8 成立 |
| 3 | ICS import（片方向のみ）| UC-R5 が ICS 範囲で代替可 |
| 4 | Slack / Email / Discord（webhook 送信のみ、受信なし）| UC-R2 成立 |
| 5 | （Calendar 双方向・Todo 双方向は範囲外）| - |

**カバー UC**: R1 / R2 / R3 / R4 / R8 ◎ ／ R5 は ICS で部分代替 ／ R6 / R7 ✗

**弱点**
- GCal の予定変更が即反映されない（ICS の poll 頻度依存、最悪 1 日遅れ）
- Todoist / Linear のタスク状態が M3E に流れない
- モバイルで鳴らない（C 軸ないので）

**採用キー**: 「外部 OAuth は政治的・心理的に嫌」「100% ローカル完結が思想」「Calendar 連携は ICS で十分」

---

### 3 案比較表

| 観点 | Plan 1 (A-small+C) | Plan 2 (B daemon) | Plan 3 (A-small only) |
|------|---------------------|-------------------|------------------------|
| 終了中の発火 | ○ OS scheduler | ○ daemon | ○ OS scheduler |
| webhook 即反映 | △ Ph6 で追加 | ◎ 初日から | ✗ ICS poll |
| 常駐リソース | なし | ~200MB | なし |
| 実装初期コスト | 中（CLI + scheduler 抽象化） | 大（tray + autostart + receiver） | 中 |
| OAuth 依存 | あり（GCal/Todoist） | あり（全部） | なし |
| モバイルで鳴る | ◎ GCal 経由 | ✗ | ✗ |
| 失敗の独立性 | ◎ 各層独立 | △ daemon 落ちで全停止 | ◎ |
| カバー UC 数 | 6/7 | 7/7 | 4/7 |
| Freeplane との差 | 大幅上 | 大幅上 | 中（終了中発火の分上） |

**最終推奨: Plan 1 で着手し、UC-R5 webhook の需要が顕在化した段階で Plan 1 → Plan 2 へ部分昇格（webhook receiver mode のみ常駐化）**

---

## 6. Glossary 追加候補（本実装に伴い登録）

`docs/00_Home/Glossary.md` に新セクション「6. Joint（外部連携）」として追加予定:

| 正規語 | 意味 | 関連語 | 備考 |
|--------|------|--------|------|
| **joint** | Map と外部サービスを取り持つ標準アダプタ層。fetch / push / notify / webhook の 4 契約で定義 | adapter, channel | 1 service = 1 adapter。registry に動的登録。実装命名は `joint` 統一 |
| **adapter** | joint の具体実装。1 service につき 1 つ | joint | （別表記）connector / integration は非推奨 |
| **channel** | joint adapter のうち **notify 系** 出口（OS / banner / Slack / Email …） | joint, adapter | reminder の宛先指定で `channel: ["os", "slack:#x"]` 形式 |
| **reminder** | node に紐付く trigger ベースの通知ルール。`absolute` / `relative` / `recurring` / `stale` / `event` / `manual` の 6 kind | nudge, channel, joint | node attribute `reminder.rules[]` に格納 |
| **nudge** | 強制度の弱い reminder。停滞検知（stale）や未完成原則の起動時 prompt が代表例 | reminder | 「OS 通知より静かなチャネル（banner）優先」が既定 |

---

## 7. Open Questions（reviews/Qn に起票予定）

未解決の設計判断は採否を決めず列挙。M3E map の `reviews/` に Q として上げる。

- **Q1.** `reminder` を node attribute に置くか、別テーブルに分離するか
  - attribute 案: 単純、export と整合
  - 別テーブル案: 全 reminder の横断クエリが速い、scheduler が node 全 scan しなくて済む
  - 暫定: **attribute、ただし scheduler 用の index を別ファイルに持つ**

- **Q2.** "stale 通知"（K1.1f, Uf4.b）は reminder の trigger kind か、別レイヤか
  - 暫定: **同じ reminder システムの 1 trigger kind として扱う**

- **Q3.** Calendar 双方向同期で、M3E 側で reminder 削除した時に GCal event も消すか
  - 案: 消す / 消さない / プロンプトで聞く / direction 別
  - 暫定: **direction === 'two-way' のとき確認 dialog**

- **Q4.** プラグイン化の閾値
  - 案: adapter 数 N 以上で抽出 / 永遠に内蔵 / 最初から plugin
  - 暫定: **3〜4 adapter 実装後に再評価**（idea/10_io/06 §6.8）

- **Q5.** 通知の rate limit / dedup（Wf5）
  - 全外部イベントを通知化すると爆発する
  - 暫定: **adapter 別 rate cap + 同一 rule の連続発火は 1 件にまとめる**

- **Q6.** マルチアカウント（GitHub 個人 vs 組織、Calendar 仕事 vs 私用）
  - 暫定: **adapter id を `<service>:<account_label>` で多重登録可**

- **Q7.** 通知の「祝日 / 休暇」スキップ（K1.6）
  - 暫定: **workspace 設定に "休息日リスト"、scheduler はそれを読んで skip**

---

## 8. 非目標（やらない / 後回し）

- スマホ app 専用 push（Phase 5 以降、モバイル app 自体が無いため）
- カスタム ringtone / 音声合成リマインダー
- 外部から M3E への CalDAV 公開サーバ化（受け側のみ）
- Reminder の機械学習による「最適時刻提案」
- joint adapter の third-party marketplace（plugin API 確定後）

---

## 9. 関連メモ / 連動 PJ

- `memory/policy_privacy.md` — outbound 必須ゲート
- `memory/project_cloud_sync_solo.md` — schema 変更は単独可（reminder 追加が atribute 変更のため）
- `memory/feedback_ambiguity_pooling.md` — Open Questions は reviews/Qn に逐次起票
- `memory/project_axes.md` — Flash 帯域に Calendar/通知系、Rapid に Issue tracker、Deep は本層に直接関与しない
