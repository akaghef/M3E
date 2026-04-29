# 04. 付箋層 — 本/付箋メタファ、コンテンツとコメントの物理分離

「本に付箋を貼るように、本のコンテンツと区別可能でなければならない」が出発点。
Deep canonicality を守るには、ノードに紐づく **暫定的コメント** をコンテンツと
別レイヤに置く必要がある。

## N1. 付箋の正体

付箋とは **ノードに局所化された暫定的内容**。
Qn / scratch / backlog（=未局所化の暫定）と対になる：

| | 局所化されてる | 未局所化 |
|---|---|---|
| Deep（確定） | map ノード本文 | （概念上ない） |
| 暫定 | **付箋** ← 新設 | scratch / Qn / backlog |

つまり付箋は「**この特定のノードに紐づいた、まだ Deep じゃない思考**」専用。
これがないと、暫定思考が Deep に混ざる（D2 違反）か、
scratch に飛んで局所性を失うかの二択になる。

## N2. 物理分離の実装オプション 4 案

### 案 A：別 kind ノード + comments_on 参照（推し）
- ノード `kind: "comment"` で `comments_on: <node_id>` を持つ
- viewer では対象ノードの脇にピン留め表示、ツリー構造には載らない
- projection 出力から default 除外
- 全付箋表示 toggle ON/OFF（"本だけ読みたいモード" を一級）

**pro**：本/付箋の物理分離が完全。付箋に付箋も付けられる。クラスタリング可  
**con**：viewer 描画追加、スキーマ拡張

### 案 B：annotations 配列 attribute（MVP 向き）
- 既存ノードに `annotations: [{author, body, ts, status}]` 追加
- 新ノード kind なし、metadata のみ

**pro**：実装最小、既存スキーマ非破壊  
**con**：グラフナビで付箋を辿れない、付箋同士の議論不可、3 段以上で破綻

### 案 C：`__comments__` 子フォルダ強制
- 各 commented ノードに synthetic な `__comments__` 子ノード
- 付箋はそこに通常ノードとして配置

**pro**：navigable  
**con**：ツリー汚染、本文と物理分離になってない（同じレイヤ）

### 案 D：Cross-cutting overlay
- `comments/` トップレベル map に独立配置、target を ID 参照

**pro**：完全分離  
**con**：局所性喪失（本を読んでも付箋見えない）、メタファ崩壊

→ **A 案推し**。ただし MVP は B 案で動かして、A 案へ進化させる順序が現実的。

## N3. 必要属性 8 つ

1. **author**（akaghef / agent role）— 匿名禁止
2. **ts**（作成時刻）
3. **target_node_id**（対象、複数可）
4. **kind**（todo / question / counter / margin-note / pointer）— 付箋色違い
5. **status**（open / resolved / promoted）
6. **promotion_target**（resolved 時の行き先）
7. **bandwidth**（Flash / Rapid）
8. **encrypted**（対象が Deep 暗号ゾーンなら付箋も暗号化）

## N4. 運用ルール 7 つ

### P1. 付箋は本文に昇格しない、編集をトリガするだけ
付箋自身が Deep になることはない。resolve 時に：
- (a) 本文編集（D6 Qn settling 経由）
- (b) 新ノード作成
- (c) Qn 起票
- (d) 破棄

のいずれかになる。**直接は Deep を汚さない**。

### P2. projection 出力からは default 除外
科研費・論文に書き出すとき付箋は混入させない。
明示的に「この付箋を本文に取り込む」をやって初めて入る。D5 read-path の延長。

### P3. 表示 toggle が一級
viewer に「付箋を全て隠す」ボタン。
**本だけを読む状態が canonical view**、付箋表示は作業 view。
これがないと「付箋まみれの汚れた本」が Deep に見えてしまう。

### P4. 付箋寿命
- **Flash 付箋**（"これ気になる" 程度）：7 日 auto-expire 警告、14 日 archive
- **Rapid 付箋**（"要対応"）：expire しない、Hermes 流に N 回後に resolve ナッジ

### P5. 付箋に付箋は OK、ただし 2 段まで
議論が深まると付箋ツリーになるが、3 段以上は **scratch / Qn に昇格** のシグナル。
本に付箋の上に付箋が 3 段積まれたら、本を直すべき。

### P6. agent 付箋と人間付箋を視覚区別
色 or マーカで region 分け。
agent 同士の対話（visual → data へのコメント）も付箋でやれば、
backlog/ にあった一部が局所化されてここに来る（→ N5 役割再分担）。

### P7. resolve は trace を残す
resolve 時に「何に化けたか」を attribute に残す：
- `resolved_into: node_id`
- `resolved_into: Qn-12`
- `dropped`

**付箋は消えるが、付箋があったという履歴は archive に残る**。
D4（Deep の demote は archive へ）と同じ哲学を付箋にも適用。

## N5. scratch / Qn / backlog との役割再分担

新設で何が増えるかというより、**何が片付くか** が重要：

| 仕組み | 付箋導入後の純化された役割 |
|---|---|
| **scratch** | 「未局所化の暫定」専用に純化。"特定ノードに紐づくメモ" は付箋へ |
| **reviews/Qn** | 「未局所化の合議」専用。付箋から promote されてきたものを受ける箱 |
| **backlog/** | agent 間 **横断的** 非同期通信。局所議論は付箋へ |
| **map ノード本文** | 真に Deep なものだけが残る |

## 既存仕組みとの差分

- `ai_agent_deep/02_sparring_agents.md` S6（コメント保存場所）：本ファイルが具体化
- `automation_obstacles/` P9（痕跡保存）：N3 author / ts / N7 trace と整合
- `keyboard_modes/` M27 Assign mode / M28 Q&A mode：付箋作成 mode の UI 親

## MVP 案

**Step 1（今すぐ）**：B 案（attribute）で動かす
- ノードに `annotations` 配列を生やす
- agent と CLI で書き読み
- viewer 表示は最小（ノードに小さなドット表示で「N 件付箋あり」を示す程度）

**Step 2（visual ロール）**：A 案へ進化
- 別 kind ノード化
- viewer に side-pin 表示、toggle ON/OFF
- 付箋から付箋を生やせる

**Step 3（運用）**：寿命・promotion フロー
- P4 寿命管理を Hermes cron janitor で自動化（02_hermes_integration_options.md I2）
- P5 段数チェック警告
- P7 trace の archive 連携

## 代替案

**alt N-noseparate**：付箋を作らず、scratch でやる
- pro：新仕組みなし
- con：局所性欠如、scratch が肥大化、Deep 汚染リスク継続

**alt N-inline**：本文に inline コメント記法（marginalia）
- pro：物理 1 レイヤで済む
- con：本/付箋の物理分離が崩壊、projection で除外しにくい

→ 物理分離が魂なので、A 案以外は妥協案。

## 観察

- 付箋は Deep canonicality を守る **第二の防衛線**（第一は D6 Qn settling）
- 付箋の寿命管理は Hermes 流の "予算駆動 consolidation" の応用
- 「本だけ読みたいモード」を一級市民にすることが、 Deep の **可視的純度** を保証する
