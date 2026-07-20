---
name: inko
description: >
  Akaghef inko 通信スキル（Claude Director 版）。
  Mac/Windows 間のエージェント通信を行うときに使う。
  以下の場面でトリガーする:
  - 「Windows Codex に送って」「Win に伝えて」「a2a で投げて」と言われたとき
  - 「inko で送って」「メッセージ送って」「依頼を投げて」と言われたとき
  - Bridge の inbox/pending を確認・処理するとき
  - エージェント間の同期待ち・返信確認をするとき
  - a2a や inko の層の使い分けを判断するとき
---

# inko — Claude Director 版

Claude（Director）が Akaghef-Bridge 経由で Windows Codex（または他エージェント）と
通信するためのスキル。

## 層モデル

```
ユーザー意図 / Director 判断
  → inko 会話契約（call / message / handoff）
    → a2a 低レイヤー輸送（Bridge filesystem への JSON 配置）
      → ~/Akaghef-Bridge/pending/mac_to_windows/
```

- **inko** = 会話の意味を持つ上位レイヤー（call か message か handoff かを決める）
- **a2a** = Bridge への JSON 配置だけを担う低レイヤー輸送（意味を持たない）
- 「a2a で送って」と言われても、会話意味は inko で決定してから a2a で配送する

## 操作の選択

| 状況 | 使うもの |
|------|---------|
| 返信を待たず非同期に依頼・通知 | **inko message** |
| 同期的に返答を待つ（このターンで close まで保持） | **inko call** |
| 人間への引き継ぎ | **human handoff** |
| Bridge queue の掃除・ルーティングデバッグのみ | raw a2a |

通常の Director→Windows Codex 依頼はほぼ **inko message**。
true call は Claude がそのターンで `call.close` まで待機する場合のみ。

---

## Inko Message の送り方

### 1. ファイル名を決める

```
{UTC timestamp}Z-mac-claude-inko-message-{topic}-{seq}.json
例: 20260615T120000Z-mac-claude-inko-message-data-sync-verify-001.json
```

タイムスタンプ生成:
```bash
date -u +%Y%m%dT%H%M%SZ
```

### 2. パケットを作る

```json
{
  "schema": "akaghef.inko.message.v1",
  "kind": "request.inko.message",
  "id": "{ファイル名から拡張子を除いたもの}",
  "thread": "{テーマを表すスラッグ}",
  "from": "mac-claude",
  "to": "windows-codex",
  "created_at_utc": "{UTC ISO8601}",
  "priority": "normal",
  "reply_to": [],
  "title": "{件名}",
  "basis": "DP2 / async inko message",
  "summary": "{1行要約}",
  "body": "{本文}",
  "request": {
    "operation": "{操作名}",
    "reply_required": true
  },
  "transport": {
    "layer": "a2a",
    "route": "Akaghef-Bridge pending/mac_to_windows"
  }
}
```

`kind` の使い分け:
- `request.inko.message` — 依頼・確認要求
- `result.inko.message` — 結果報告（返信）
- `notify.inko.message` — 通知のみ（返信不要）

### 3. Bridge に配置する

```bash
cp /tmp/{packet}.json ~/Akaghef-Bridge/pending/mac_to_windows/{filename}.json
```

Claude は直接 Bash で書く（Codex 経由不要）。

---

## Inko Call の送り方

同期呼び出し。Claude がこのターンで返答を待って `call.close` まで処理する場合のみ使う。

### call.open パケット

```json
{
  "schema": "akaghef.inko.call.v1",
  "kind": "call.open",
  "id": "{id}",
  "call_id": "inko-{UTC timestamp}-{topic}",
  "thread": "{thread}",
  "from": "mac-claude",
  "to": "windows-codex",
  "created_at_utc": "{UTC ISO8601}",
  "priority": "normal",
  "title": "{件名}",
  "goal": "{達成条件}",
  "done_when": "{完了判定}",
  "max_rounds": 3,
  "timeout_seconds": 300,
  "basis": "DP2 / inko call"
}
```

### call.close パケット

```json
{
  "schema": "akaghef.inko.call.v1",
  "kind": "call.close",
  "call_id": "{同じ call_id}",
  "thread": "{thread}",
  "from": "mac-claude",
  "to": "windows-codex",
  "status": "done",
  "summary": "{結果要約}"
}
```

True call は `call.open` → 返答待ち → `call.close` のサイクルを守る。
返答を待たずに終わるなら **inko message** を使うこと。

---

## Bridge の確認・受信

```bash
# Win→Mac の受信ボックスを確認
ls ~/Akaghef-Bridge/pending/windows_to_mac/

# 内容を読む
cat ~/Akaghef-Bridge/pending/windows_to_mac/{file}.json | python3 -m json.tool

# 処理済みをアーカイブ
mv ~/Akaghef-Bridge/pending/windows_to_mac/{file}.json \
   ~/Akaghef-Bridge/done/windows_to_mac/
```

---

## DP ルーター

- **DP0**: inko プロトコル自体の設計・修正。実際には送らない。
- **DP1**: 初回実地送信。スモークテスト。thread・goal・timeout を明示する。
- **DP2**: 通常運用。既存ルートを使い、結果を append で記録する。

---

## 注意事項

- **`from` フィールド**: Codex セッション経由なら `mac-codex`、Claude 直接なら `mac-claude`
- **`thread`**: 同一の話題は同じ thread スラッグを使い続ける（例: `m3e-workspace-data-sync`）
- **`reply_to`**: 返信する場合は元メッセージの id を入れる
- **手書き JSON の格**：低レイヤー transport デバッグとして許容されるが、会話意味は必ず `schema` と `kind` で明示する
- **重複チェック**: 送る前に同じ thread の未処理パケットが既にないか確認する
  ```bash
  ls ~/Akaghef-Bridge/pending/mac_to_windows/ | grep {thread}
  ```
