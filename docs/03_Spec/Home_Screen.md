# Home Screen 仕様書

作成日: 2026-04-14
ステータス: Draft — 要レビュー

## 1. 目的

M3E 起動時の「玄関」となる画面。ユーザーが複数の **map** を管理するための**map 一覧ビュー**として機能する。viewer は「1つの map を開いて編集する場所」、Home は「どの map に入るか選ぶ場所」。

## 2. 基本方針

- **Home = map 一覧ビュー**。scope tree や tag 一覧は補助であって主役ではない。
- `/` アクセスで Home が開く。
- Home と viewer は別画面（別 HTML）。遷移で行き来する。
- 現状の「title + All Scopes だけ」は廃止。

## 3. アクセス方法

| 入口 | 遷移先 |
|---|---|
| `http://<host>/` | `home.html` |
| `http://<host>/home.html` | `home.html` |
| viewer ヘッダーの **M3E ロゴ**クリック | `home.html` |
| viewer 内 **Alt+H** | `home.html`（別画面に遷移。現状のオーバーレイは廃止） |
| home.html の M3E ロゴクリック | 何もしない（現在地） |

## 4. 画面構成

Miro のダッシュボードに近いイメージ。上から「新規作成」「ピン止め」「全 map」「Archived」の縦並び。

```
┌──────────────────────────────────────────────────────┐
│ M3E                                                   │  ← ヘッダー
├──────────────────────────────────────────────────────┤
│                                                       │
│  Create new                                           │  ← §4.2 新規作成
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │ [+]      │ │ [📘]     │ │ [📥]              │   │
│  │ Blank    │ │ Obsidian │ │ Import .md / JSON │   │
│  │          │ │ Vault    │ │                   │   │
│  └──────────┘ └──────────┘ └───────────────────┘   │
│                                                       │
│  ⭐ Pinned                                            │  ← §4.3 ピン止め
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                │
│  │ 📄 ...  │ │ 📄 ...  │ │ 📄 ...  │                │
│  └─────────┘ └─────────┘ └─────────┘                │
│                                                       │
│  Documents                            [search…]       │  ← §4.4 全一覧
│  ┌────────────────────────────────────────────────┐  │
│  │ ☆ 📄 研究メモ A                                 │  │
│  │    12 nodes · updated 2h ago · #research        │  │
│  │                                 [open] [⋯]      │  │
│  ├────────────────────────────────────────────────┤  │
│  │ ★ 📄 プロジェクト X     (obsidian: ~/vault/X) │  │
│  │    45 nodes · updated yesterday · #project      │  │
│  │                                 [open] [⋯]      │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  [▸ Archived (3)]                                    │  ← §4.5
│                                                       │
└──────────────────────────────────────────────────────┘
```

### 4.1 ヘッダー
- 左: `M3E` ロゴテキスト（クリック無効 = 現在地）
- 右: （空 or ユーザー設定などの将来枠。New Document は §4.2 に移動）

### 4.2 Create new（新規作成カード群）
Miro のテンプレート選択のように、**複数の作成方法をカードで並べる**。

| カード | 動作 |
|---|---|
| **Blank** | `POST /api/docs/new` → 空 map を作り viewer へ遷移 |
| **Obsidian Vault** | vault ディレクトリを選択 → そのディレクトリを source とする tight-coupled map を作成（§4.2.1） |
| **Import .md / JSON** | ファイル選択 → パースして map 化（既存の md_reader を配線） |

#### 4.2.1 Obsidian Vault との tight coupling
- vault ディレクトリを選ぶと、その中の `.md` を node として取り込み、以後は双方向同期。
- map の `source` 属性に vault path を持たせる（`source: { kind: "obsidian", path: "..." }`）。
- 一覧カードの 2 行目に `obsidian: <vault path>` を副表示。
- Phase 1 では UI の枠だけ用意し、ボタンは "Coming soon" 無効化でも可。ただし**設計はこの仕様書で確定させる**。

### 4.3 Pinned（スター付き）
- ユーザーが星マークを付けた map を横並びカードで上部に表示。
- 各カードから直接 viewer へ遷移。
- ピンのトグルは Documents リストの各行の `☆/★` で行う。
- サーバに永続化（`PATCH /home/docs/:id/pin { pinned: true }` を新規追加。`DocSummary` に `pinned: boolean` フィールド追加）。
- Pinned が 0 件ならセクションごと非表示。

### 4.4 Documents（全一覧）
**全 map** を更新日時降順で並べる（ピンの有無に関係なく全件）。

各行（Map Card）:
- 左端: `☆/★` ピントグル
- アイコン（📄 or source別に 📘=obsidian など）
- **map ラベル**（クリックで viewer へ）
- サブテキスト: `<nodeCount> nodes · updated <relative time> · <tags> [· obsidian: <path>]`
- 右側: `[open]` `[⋯]`（rename / duplicate / archive / delete / unbind from vault）

データソース: 既存の `GET /api/docs` → `DocSummary[]`
- 既存: `label`, `savedAt`, `nodeCount`, `tags`, `archived`
- **追加**: `pinned`, `source`（§4.2.1）

### 4.5 Search
- Documents セクション右上に検索ボックス。label と tags を対象にクライアント側フィルタ。
- Phase 1 は label 前方一致のみで可。

### 4.6 Archived
- `archived=true` の doc はデフォルト非表示。
- 「▸ Archived (N)」の折りたたみをクリックで展開。
- 展開時はカード UI、グレーアウト＋`[restore]`/`[delete]` アクション。

## 5. 廃止・移動するもの

| 項目 | 処遇 |
|---|---|
| 現在の `#home-screen` オーバーレイ（viewer.html 内） | **削除** |
| 現在の `home-title` / `home-body` (All Scopes のみ) | **削除** |
| All Scopes セクション | **Phase 2 以降で再検討**。Home の主役ではない |
| Tags セクション | **Phase 2 以降で再検討**。代わりに各 map カードに tags を表示 |

## 6. インタラクション

| 操作 | 動作 |
|---|---|
| Document カードのラベルクリック | `viewer.html?docId=<id>` へ遷移 |
| `[open]` | 同上 |
| `[+ New Map]` | `POST /api/docs/new` → 返ってきた id で viewer へ遷移 |
| `[⋯] > rename` | インライン編集 → `PATCH /api/docs/:id` (label) |
| `[⋯] > archive` | `POST /home/docs/:id/archive` → 一覧更新 |
| `[⋯] > delete` | 確認ダイアログ → `DELETE /home/docs/:id`（archived 済みのみ） |
| search 入力 | 即時フィルタ |

## 7. 使用するエンドポイント

既存のものを使う：
- `GET /api/docs` — 一覧取得（`pinned` / `source` フィールド追加）
- `POST /api/docs/new` — 新規作成
- `PATCH /api/docs/:id` — label 変更
- `POST /home/docs/:id/archive` — アーカイブ
- `DELETE /home/docs/:id` — 削除
- `PATCH /home/docs/:id/tags` — tags 編集

**新規追加**:
- `PATCH /home/docs/:id/pin` — ピン止めトグル（body: `{ pinned: boolean }`）
- `POST /api/docs/import-vault` — Obsidian vault ディレクトリを source として新 map 作成
  （Phase 1 でスタブだけ用意し、Phase 3 で本実装）

## 8. ファイル構成

```
beta/
├── home.html           ← 新規（ヘッダー + Documents リストの箱）
├── viewer.html         ← 修正（#home-screen 削除、ロゴ追加）
├── viewer.css          ← 修正（.home-* 刷新）
└── src/
    └── browser/
        └── home.ts     ← 新規（Document リストの render + API 呼び出し）
```

サーバ側:
- [beta/src/node/start_viewer.ts](beta/src/node/start_viewer.ts) の `DEFAULT_PAGE` を `"home.html"` に変更。

## 9. 実装範囲

§4 全部を一括実装する。Obsidian tight coupling（§4.2.1）と Import .md/JSON（§4.2）も同時に配線する（md_reader / md_writer 既存モジュールを接続）。分割しない。

## 10. デフォルト決定（自動）

判断のつく細目はこちらで決める。違ったら指摘してもらう。

- ソート順: **更新日時降順**
- Archived: **折りたたみ**（別タブにしない）
- `[⋯]` メニュー: rename / duplicate / archive / delete / unbind-from-vault（export/share は出さない）
- 検索対象: **label + tags 両方**
- Pinned 0 件時: **セクションごと非表示**
- 既存 map を後から vault に bind する動線: `[⋯] > bind to vault` を**用意する**
- Create new カード: 3 枚すべて実装し有効化（§9 のとおり Obsidian/Import も同時に配線）

## 11. 本仕様の範囲外

- Obsidian vault との同期粒度・データマッピングは [Obsidian_Vault_Integration.md](./Obsidian_Vault_Integration.md) の管轄。Home 側では「vault を bind する入口」「bind 中の map を一覧表示」「unbind する動線」のみを規定する。
