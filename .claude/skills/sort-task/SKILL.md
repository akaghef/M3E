---
name: task-deps
description: >
  タスクプール（アイデアリスト、PJ候補、TODO群、backlog等）から相互依存関係を推論・整理して、
  DAG 形式で `projects/deps.json` に書き出すスキル。`scripts/deps/deps.py` をバックエンドに使う。
  以下の場面でトリガーする:
  - 「依存関係整理」「DAG化」「実行順決める」「タスクの前後関係」と言われたとき
  - タスク・PJ・マイルストーンの集合を渡されて「どこから始める？」「並列化できる？」と聞かれたとき
  - backlog/*.md や idea/ 配下のリストを「整理して」と依頼されたとき
  - 既存 `projects/deps.json` への追記・編集を依頼されたとき
---

# task-deps — タスク依存の整理

相互依存のあるタスク群を受け取って、依存関係を推論または受領し、DAG として `projects/deps.json` に落とす。
Claude 自身がそのあとの推論（実行順ソート、クリティカルパス、並列集合）に使える substrate を提供する。

## バックエンド依存

- `scripts/deps/deps.py`（Python 3.10+ / networkx）
- `projects/deps.json`（single source of truth）

いずれも不在なら、スキル実行前にユーザに確認して整備する。

## 入力形式（何を受け取るか）

以下のどれかで指示される想定:

1. **直接列挙**: 「タスクA, B, C, D の依存を整理」
2. **ファイル参照**: 「`backlog/pj-vision-100.md` の1–10を DAG 化」「`idea/00_meta/` の README を対象に」
3. **差分追加**: 「PJ-09 を追加、PJ-01 の後・PJ-02 の前」
4. **既存更新**: 「deps.json の PJ-04 state を active に」「PJ-06→PJ-07 のエッジ削除」

## 動作手順

1. **入力を特定する**
   - ソース（会話 / ファイル / 既存 deps.json）を確認
   - タスク ID 規則を決める（既定: `PJ-NN`、任意 prefix 可）

2. **タスクを列挙する**
   - 各タスクに `id`（必須）, `title`, `state`（省略時 `draft`）, `priority`（省略時 0）
   - ID が未定なら空き番号を機械的に採番（欠番は再利用しない）

3. **依存関係を決める**
   - **明示指示 > 推論** の順で優先
   - 推論の手がかり:
     - タイトル・説明中の「基盤」「substrate」「prerequisite」「の前提」等
     - 片方の成果物を他方が必要とするか
     - 既知の依存（conversation / memory / 既存 deps.json）
   - **確信がない依存は引かない** — 後述の review pool にまとめてユーザに確認

4. **DAG に書き込む**
   - `python scripts/deps/deps.py add <id> --title "..." [--state S] [--priority N]`
   - `python scripts/deps/deps.py dep <from> <to>`
   - 既存ノードへの edge 追加ならそれだけ呼ぶ
   - **サイクル化するエッジは deps.py が自動で拒否** — そのまま review pool へ

5. **検証する**
   - `python scripts/deps/deps.py check` で cycle / unknown state / 参照切れを確認
   - 失敗したら ユーザに報告して停止

6. **結果を提示する**
   - 追加/変更したノード数・エッジ数
   - `python scripts/deps/deps.py critical` の出力（クリティカルパス）
   - `python scripts/deps/deps.py layers` の出力（並列集合）
   - `python scripts/deps/deps.py ready` の出力（今すぐ着手可能）
   - **review pool**: 自信のない依存候補を「採用/却下」で問う形で列挙

## 依存推論の原則

- **ユーザが述べた依存を最優先** — 会話・memory・指示文の明示 > 推論
- **書かれていない依存は引かない** — 空想でエッジを足さない
- **共通基盤は共通基盤** — 「A が B, C, D の前提」は A→B, A→C, A→D の3エッジ
- **循環は禁忌** — 循環に見える場合はタスクを分割する提案を出す（自動分割しない）
- **粒度が揃わないとき** — 小粒タスクを大粒タスクの子として扱わず、親タスクのみ DAG に載せる（別レイヤで管理）

## 出力形式

### deps.json の書き換え
最小差分で更新。既存ノードの state / priority / title を勝手に変えない（明示指示があれば変える）。

### 応答テキスト（ユーザ向け要約）
```
追加: 3 node / 5 edge
critical path: PJ-01 → PJ-04 → PJ-07
layers:
  L0: PJ-01 PJ-06 PJ-08 PJ-04
  L1: PJ-03 PJ-02 PJ-07
ready: PJ-01 PJ-06 PJ-08 PJ-04

review pool（自信のない依存候補）:
  [ ] PJ-05 → PJ-03 ?  (ObserveSelf の出力を DogfoodDeep が使う可能性)
  [ ] PJ-02 → PJ-05 ?  (HarnessTranspose の記録を ObserveSelf に繋ぐ案)
```

## 禁則

- ユーザ承認なしに不確定な依存を引かない
- 既存 deps.json の state / priority / title を勝手に書き換えない
- node ID を勝手に rename しない
- deps.py が存在しない状態で実行しようとしない（先に整備確認）
- 大量タスクを一度に DAG 化する時、**10ノード/エッジ** を超える操作はドライラン（差分提示）してからユーザ承認 → 実行

## 使用例

### 例1: 新規 PJ 群を DAG 化
```
ユーザ: backlog/pj-vision-100.md の Meta / Foundation セクションを DAG 化して
→ PJ-01..10 を add、依存関係を推論して dep、critical/layers/ready を要約
```

### 例2: 差分追加
```
ユーザ: PJ-09「プロンプト資産レジストリ」を追加。PJ-01 の後・PJ-02 の前。
→ add PJ-09 + dep PJ-01 PJ-09 + dep PJ-09 PJ-02
```

### 例3: review pool 処理
```
ユーザ: review pool 全部却下
→ 何もしない（提案エッジは引かない）

ユーザ: PJ-05→PJ-03 は採用、残りは却下
→ dep PJ-05 PJ-03 のみ実行
```

## 可視化 (M3E マップへの表示)

DAG を M3E マップの **`SortedTaskView`** ノード配下にレンダリングする。
M3E API は `/.claude/skills/m3e-map/` を参照。

### レンダリング仕様

- ルート直下（または指定位置）に `SortedTaskView` フォルダノードを作成
- 存在するなら中身を全置換（レイアウト再構築）
- 構造:
  ```
  SortedTaskView
  ├── meta
  │   ├── critical-path: PJ-01 → PJ-03
  │   ├── open: 9 / total: 9
  │   └── last-render: 2026-04-16T12:34:56
  └── layers
      ├── L0 (6 parallel)
      │   ├── PJ-01 TrustEng
      │   ├── PJ-04 InfoGather
      │   └── ...
      └── L1 (3 parallel)
          └── ...
  ```
- 各 PJ ノード:
  - `text`: `PJ-NN title`
  - `attributes`: `{ pj_id, state, priority, score, layer }`
  - `details`: `descendants: N, depth: N, blockers: [...]`
- 依存関係は **GraphLink** として `state.links` に追加
  - `sourceNodeId`: prerequisite PJ nodeId
  - `targetNodeId`: dependent PJ nodeId
  - `direction`: `"forward"`
  - `style`: `"default"` （クリティカルパス上のエッジは `"emphasis"`）
  - `relationType`: `"depends-on"`
  - `label`: 省略（グラフが煩雑になるため）

### 実装手順（bulk write）

1. `scripts/deps/deps.py layers --json` でレイヤ構造を取得
2. `scripts/deps/deps.py critical --json` でクリティカルパスを取得
3. GET `/api/docs/akaghef-beta` で現行 state を取得
4. 既存の `SortedTaskView` を探す:
   - あれば descendants を全削除（ノード本体は再利用して children だけ差し替え）
   - なければ root 直下に新規作成
5. layers / critical / deps 情報をもとにノード＆リンクを構築
6. POST `/api/docs/akaghef-beta` で全体を保存
7. `curl -w "%{http_code}"` で 200 を確認

### トリガー（スキル呼び出し時）

- 「可視化」「M3Eに表示」「SortedTaskView に出して」「render」と言われたとき
- DAG 更新後、明示指定がなくても **差分要約に続けて** 可視化するかを問う

### 前提条件

- M3E beta サーバが起動していること（`http://localhost:4173`）
- 停止中なら `/launch-beta` を促してから実行

### エッジケース

- **サイクル**: 可視化前に `check` で検出、失敗したら可視化しない
- **空グラフ**: SortedTaskView 配下を空にするか、ノード自体を削除する
- **100 ノード超**: layers 表示は保つが、critical path 以外の GraphLink は省略オプション (`--no-links`) を検討

## 関連スキル・ファイル

- `scripts/deps/deps.py` — バックエンド CLI
- `projects/deps.json` — データファイル
- `.claude/skills/m3e-map/` — マップ API 規約
- `backlog/pj-vision-100.md` — PJ ビジョンの列挙
- `idea/00_meta/` — meta PJ 素材
- feedback memory `feedback_ambiguity_pooling` — 曖昧な依存は pool 化して batch review
