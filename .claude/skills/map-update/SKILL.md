---
name: map-update
description: M3E マップの strategy board のタスクステータスや Agent Status を一括更新するスキル。以下の場面でトリガーする：「マップ更新」「ステータス更新」「Agent Status 更新」「進捗反映」「マップに反映」「strategy 更新」と言われたとき、またはタスク完了後にマップへの反映が必要なとき。
---

# map-update — Strategy Board & Agent Status 一括更新

M3E マップの開発進捗を効率的に反映するスキル。
一時スクリプトを書かずに、構造化された指示から直接マップを更新する。

## API

- Base URL: `http://localhost:4173`（beta 開発サーバー）
- Document ID: `akaghef-beta`
- `GET /api/docs/akaghef-beta` → 全状態取得
- `POST /api/docs/akaghef-beta` → 全状態書き戻し

> **注意**: final サーバー (4173) ではなく beta サーバー (4173) を使うこと。開発データは beta で管理する。

## 使い方

ユーザーまたはマネージャーから以下のような指示を受ける:

```
/map-update
- "conflict backup" → 完了（ノード削除）
- "entity list UI" → 途中（進捗: デザイン完了、実装着手中）
- Agent Status: data=infra構築中, visual=idle
```

## 実行フロー

### Step 1: サーバー確認

```bash
curl -sf http://localhost:4173/api/docs/akaghef-beta -o /dev/null && echo "OK" || echo "SERVER_DOWN"
```

サーバーが停止していたら「M3E サーバーが停止しています」と報告して終了。

### Step 2: 更新スクリプト生成

指示内容を解析し、以下の操作を行う Node.js スクリプトを `c:/Users/chiec/dev/M3E/tmp/map_update.mjs` に生成する。

スクリプトのテンプレート:

```javascript
import http from "http";

const fetch = () => new Promise((resolve, reject) => {
  http.get("http://localhost:4173/api/docs/akaghef-beta", res => {
    let d = "";
    res.on("data", c => d += c);
    res.on("end", () => resolve(JSON.parse(d)));
  }).on("error", reject);
});

const post = (data) => new Promise((resolve, reject) => {
  const body = JSON.stringify(data);
  const req = http.request({
    hostname: "localhost", port: 4173,
    path: "/api/docs/akaghef-beta", method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) }
  }, res => {
    let d = "";
    res.on("data", c => d += c);
    res.on("end", () => resolve(JSON.parse(d)));
  });
  req.on("error", reject);
  req.write(body);
  req.end();
});

let idCounter = 1;
function newId() { return `n_upd_${Date.now()}_${idCounter++}`; }

function addChild(nodes, parentId, text, attrs = {}) {
  const id = newId();
  nodes[id] = {
    id, parentId, children: [], nodeType: "text",
    text, collapsed: false, details: "", note: "",
    attributes: attrs, link: ""
  };
  if (nodes[parentId]) nodes[parentId].children.push(id);
  return id;
}

const data = await fetch();
const nodes = data.state.nodes;

// === ここに更新ロジックを挿入 ===
// 例:
// for (const [id, n] of Object.entries(nodes)) {
//   if (n.text === "conflict backup save/restore") {
//     n.attributes.status = "done";
//     addChild(nodes, id, "2026-04-09 完了", { type: "progress" });
//   }
// }

const result = await post(data);
console.log(JSON.stringify(result));
```

### Step 3: 進捗の表現ルール

マップ上のタスクは以下の3状態で表現する:

| 状態 | マップ上の表現 |
|------|--------------|
| **完了** | **ノードを削除する**（親の children から除去 + nodes から削除） |
| **未着手** | ノード単体のまま（子ノードなし） |
| **途中** | 子ノードとして進捗メモを追加 |

#### A. 完了 → ノード削除

タスクが完了したら、そのノードをツリーから除去する。

```javascript
function removeNode(nodes, nodeId) {
  const node = nodes[nodeId];
  if (!node) return;
  // 親の children から除去
  const parent = nodes[node.parentId];
  if (parent) {
    parent.children = parent.children.filter(cid => cid !== nodeId);
  }
  // 子ノードも再帰的に削除
  for (const childId of (node.children || [])) {
    removeNode(nodes, childId);
  }
  delete nodes[nodeId];
  console.log("Removed (done):", node.text);
}

for (const [id, n] of Object.entries(nodes)) {
  if (n.text === "完了したタスク名") {
    removeNode(nodes, id);
    break; // text検索なのでbreak
  }
}
```

#### B. 途中 → 子ノードに進捗メモ追加

作業途中のタスクには子ノードとして進捗メモを追加する。

```javascript
for (const [id, n] of Object.entries(nodes)) {
  if (n.text === "タスク名") {
    addChild(nodes, id, "2026-04-09 50%完了。○○まで実装済み", { type: "progress" });
    console.log("Added progress to:", n.text);
  }
}
```

#### C. Agent Status 更新

DEV フォルダ配下の "Agent Status" フォルダの子ノードを更新する。
既存のエージェントノードのテキストを上書きする方式。

```javascript
for (const [id, n] of Object.entries(nodes)) {
  if (n.text === "Agent Status") {
    for (const childId of n.children) {
      const child = nodes[childId];
      if (!child) continue;
      const role = child.attributes?.role;
      if (role === "data") {
        child.text = "[data: idle ; PR#23 Cloud Sync Phase1完了]-[next: Markdown export]";
        child.attributes.status = "idle";
      }
      // 他のロールも同様に更新
    }
    console.log("Updated Agent Status");
  }
}
```

#### D. ノード追加

strategy の特定カテゴリに新しいタスクノードを追加する。

```javascript
for (const [id, n] of Object.entries(nodes)) {
  if (n.text === "Collaboration & Sync") {
    addChild(nodes, id, "新しいタスク名", { status: "ready", agent: "data", priority: "P2" });
    console.log("Added task under:", n.text);
  }
}
```

### Step 4: スクリプト実行

```bash
node c:/Users/chiec/dev/M3E/tmp/map_update.mjs
```

結果を確認し、`{"ok": true}` を確認。

### Step 5: 一時ファイルは tmp/ に残す

一時スクリプトは `tmp/` に蓄積される。毎回削除しない。
`tmp/` は `.gitignore` 済みなので git に影響しない。
必要に応じて `tmp/` 内をまとめてクリーンする。

### Step 6: 結果報告

更新した内容を箇条書きで報告:

```
マップ更新完了:
- conflict backup save/restore → done + 進捗ノート追加
- Freeplane .mm export → done + 進捗ノート追加
- Agent Status:
  [data: idle ; PR#23完了]-[next: 未定]
  [visual: working ; entity list UI実装中]-[next: SSE自動更新]
```

## 自動更新ルール: Agent Status

**map-update を実行するたびに、Agent Status も必ず更新する。**

現在稼働中のエージェント（バックグラウンドタスク）の状況を確認し、Agent Status ツリーに反映する。

確認方法:
1. 会話中で起動したエージェント（`Agent` ツールで `run_in_background: true` で起動したもの）の完了通知を確認
2. まだ完了通知が来ていない → `working`
3. 完了通知が来た → `idle` + 次タスク名

### Agent Status フォーマット（統一）

各ノードの `text` は以下の形式に統一する:

```
[{role}: {status} ; {current task}]-[next: {next task}]
```

- **role**: エージェント名（data, visual, team, manage, data2 など）
- **status**: `idle` / `working` / `blocked` の3値
- **current task**: 直近やったこと or 今やっていること（稼働状況）
- **next task**: 次にやる予定のタスク。未定なら `未定`

例:
- `[data: idle ; PR#23 Cloud Sync Phase1完了]-[next: 未定]`
- `[visual: working ; entity list UI実装中]-[next: SSE自動更新]`
- `[team: working ; PR#23レビュー・マージ中]-[next: —]`
- `[manage: idle ; 全方針確定]-[next: Miro比較+H1評価基準]`

attributes は従来通り `{ "role": "data", "status": "idle" }` を維持する。

## 注意事項

- サーバーが停止中は更新不可。ユーザーに起動を依頼する
- ノードの text は完全一致で検索する。見つからない場合は部分一致を試みて確認する
- POST は全状態の上書きなので、GET → 変更 → POST の順を厳守
- 一度に大量の変更をする場合でも1回の GET/POST で完結させる
