# 03. 知識管理ツール統合 — Obsidian/Roam/Logseq・Zotero（H3, H4）

研究者の **既存知識資産** を M3E に流し込む選択肢を列挙。
ここの統合は import 中心で、データが既にローカルにあるため OAuth 不要で着手しやすい。

## H3. Obsidian/Roam/Logseq 統合

### H3.1 想定統合先の特性比較

| ツール | 保存形式 | リンク記法 | ブロック構造 | クラウド | 採用率 |
|-------|---------|-----------|-------------|---------|-------|
| Obsidian | ローカル .md | `[[wikilink]]` | 行ベース | sync 別売 | 高 |
| Roam Research | クラウド JSON | `[[link]]` `((block))` | block 単位 | 必須 | 中 |
| Logseq | ローカル .md / .org | `[[link]]` `((block))` | block 単位 | 任意 | 中 |
| Tana | クラウド | super-tag | block | 必須 | 低 |
| Notion | クラウド | DB linked | block | 必須 | 高 |
| Foam | ローカル .md | wikilink | 行 | git | 低 |

→ **Obsidian** を最優先候補に置くと API 不要・資産も多い。

### H3.2 import の粒度（Mp）

| ID | 粒度 | M3E での対応 |
|----|------|-------------|
| H3.2.a | 1 .md ファイル = 1 ノード | text にファイル全体 |
| H3.2.b | ヘッダーごと（# H1 / ## H2）= ノード分割 | 階層構造保存 |
| H3.2.c | 段落ごと = ノード | 過細粒、爆発 |
| H3.2.d | block ごと（- リスト要素）= ノード | Roam/Logseq 互換 |
| H3.2.e | ファイル + frontmatter のみ取り込み、本文は link 先 | 軽量 |
| H3.2.f | folder = subtree、file = ノード | フォルダ階層保存 |

推し: **H3.2.f + H3.2.b 併用**。フォルダ構造を尊重しつつ、長文は ヘッダー単位で分割。

### H3.3 wikilink の変換

| ID | 戦略 |
|----|------|
| H3.3.a | `[[note]]` → ノード間 link を即作成 |
| H3.3.b | `[[note]]` → text に保持、後で link 化 |
| H3.3.c | 別途 mapping table を持ち、リネーム追従 |
| H3.3.d | 双方向リンク作成（Obsidian の backlink 互換） |
| H3.3.e | `[[note#header]]` の ヘッダー指定 → 子ノード参照 |
| H3.3.f | `[[note^block-id]]` block ref → 特定ノード ID 参照 |

### H3.4 frontmatter の扱い

```yaml
---
tags: [research, idea]
date: 2026-04-16
status: draft
---
```

| ID | 戦略 |
|----|------|
| H3.4.a | `tags:` → ノード tag |
| H3.4.b | `date:` → ノード attribute |
| H3.4.c | `status:` → ノード status |
| H3.4.d | 全フィールドを attributes として保持 |
| H3.4.e | カスタムマッピング設定 UI |

### H3.5 同期方向

- H3.5.a Obsidian → M3E のみ（一方通行 import）
- H3.5.b M3E → Obsidian export（マップを Vault 化）
- H3.5.c 双方向同期（最難）
- H3.5.d 並行運用（同じファイルを両方で読む、書き込みは片方）

H3.5.d は H1.6.b（ノード別 .md ファイル化）と合致。M3E が Obsidian Vault そのものを生成する未来。

### H3.6 Roam/Logseq 特有の対応

- block-level reference `((id))` → M3E ノード ID 参照
- daily notes → daily ノード（G1 連動）
- query block → M3E のフィルタビュー保存
- inheritance（block 継承）→ M3E の link で代替

### H3.7 import ワークフロー

| ID | フロー | UX |
|----|-------|-----|
| H3.7.a | 一度きりの import（移行用）| 「Obsidian Vault を選択」→ 全部読み込み |
| H3.7.b | 継続同期（watch）| Vault フォルダ監視、変更を反映 |
| H3.7.c | 選択的 import | ファイル単位でチェックボックス |
| H3.7.d | dry-run プレビュー | 何ノード作られるか事前表示 |
| H3.7.e | 重複検出（既存 D1 連携）| 既ノードと衝突したら merge 候補 |

### H3.8 import のリスク

- 数千ノードが一気に流入 → マップが破綻（feedback_dev_map_size と矛盾）
- frontmatter の解釈差で属性ぐちゃぐちゃ
- リネームしたノードのリンクが切れる
- 暗号化前のファイルを取り込んでしまう（policy_privacy 違反リスク）

→ scope パラメータで「import 専用 workspace」に隔離が安全。

### H3.9 ユースケース

- UC-O1. 過去 3 年分の Obsidian Vault を新 workspace に移行
- UC-O2. Obsidian での読書ノート → M3E で議論構造化
- UC-O3. M3E 編集 → Obsidian で外出先閲覧
- UC-O4. Logseq の daily notes を M3E の deep timeline ビューに
- UC-O5. Roam graph の block ref を M3E の link に変換

## H4. Zotero 統合

### H4.1 接続方式の比較

| ID | 方式 | 認証 | リアルタイム性 |
|----|-----|------|--------------|
| H4.1.a | SQLite 直読み（zotero.sqlite）| 不要 | 起動中は手動 |
| H4.1.b | Local API (port 23119) | 不要（ローカル）| あり |
| H4.1.c | Web API (api.zotero.org) | API key | あり |
| H4.1.d | Better BibTeX export ファイル監視 | 不要 | ファイル更新時 |
| H4.1.e | Zotero プラグインから push | プラグイン作成必須 | リアルタイム |

推し: **H4.1.b (Local API)** が安全・楽。Zotero 起動中なら同期 OK。

### H4.2 何を取り込むか

| ID | データ | M3E 上の表現 |
|----|-------|-------------|
| H4.2.a | Item メタデータ（title/author/year/DOI）| 文献ノード |
| H4.2.b | Collection（フォルダ）| subtree |
| H4.2.c | Tag | tag |
| H4.2.d | Note（手書きメモ）| 子ノード |
| H4.2.e | Annotation（PDF ハイライト）| 孫ノード or attribute |
| H4.2.f | Attachment（PDF パス）| attribute（リンクのみ）|
| H4.2.g | Related items | ノード間 link |

### H4.3 文献ノードのデータモデル

```json
{
  "id": "node-...",
  "type": "literature",
  "text": "Author (Year). Title.",
  "attributes": {
    "doi": "10.xxx/...",
    "year": 2024,
    "authors": ["A", "B"],
    "venue": "...",
    "zotero_key": "ABC123",
    "bibtex_key": "smith2024foo"
  }
}
```

論点:
- attribute をどこまで構造化するか（フラット vs 入れ子）
- bibtex_key を主 ID にするか zotero_key を主 ID にするか
- 著者を文字列1個 vs 配列で持つか

### H4.4 アノテーション → ノード変換

PDF のハイライト・コメントを M3E に流す方法:

| ID | 戦略 |
|----|------|
| H4.4.a | ハイライト1個 = 1ノード（孫ノード）|
| H4.4.b | ハイライト群を1ノードに集約（本文として）|
| H4.4.c | ハイライトはマップ外、attribute にリンクのみ |
| H4.4.d | コメントだけノード化、ハイライトテキストは attribute |
| H4.4.e | AI が要約 → 1ノードにまとめる |

### H4.5 引用と論文出力（H5/B1 連動）

- 文献ノードを論文 export に組み込み
- ノード本文中で `@smith2024foo` 記法 → BibTeX キー解決
- export 時に bibliography 自動生成
- 「この論文で引用予定」属性を付与

### H4.6 同期方向

- H4.6.a Zotero → M3E のみ（推奨初期）
- H4.6.b M3E でメモ追加 → Zotero Note に書き戻し（双方向）
- H4.6.c M3E でタグ追加 → Zotero タグに反映
- H4.6.d M3E から「文献追加」→ Zotero に新規 Item

### H4.7 ユースケース

- UC-Z1. 論文執筆中、Discussion で議論する文献群を subtree 化
- UC-Z2. 読書セッション: 読んだ論文を M3E に取り込み、賛成/反対 link を張る
- UC-Z3. 文献 review 論文の構造設計
- UC-Z4. Zotero collection と M3E subtree を同期、研究領域マップ化
- UC-Z5. PDF 注釈を M3E に流し、注釈間の関係を可視化

### H4.8 Zotero 統合のリスク

- 大量の文献（数千）一括 import で爆発
- DOI 重複の merge ロジック必要
- attachment の PDF パスが OS 依存
- API key の保管（policy_privacy）

## H3 + H4 横断の論点

### Kn1. 知識管理ツール群の役割分担
- Obsidian: 長文ノート → M3E: 構造可視化
- Zotero: 文献メタデータ → M3E: 議論構造
- M3E は **構造を担う**、Obsidian/Zotero は **生データを担う**

### Kn2. 「import 専用 workspace」パターン
- 既存 M3E workspace を汚さない
- import → 整理 → 必要部分だけメイン workspace に昇格

### Kn3. SQLite/ローカルファイル直読みの統一基盤
- H1（git）H3（Obsidian）H4（Zotero）すべてローカルファイル
- 統一 import インフラを作れば再利用効く

### Kn4. 文献ノードと thinking ノードの区別
- 文献ノード: 引用・出典あり、外部由来
- thinking ノード: 自分の思考、出典なし
- この区別を type/attribute で持つ

## 推し度ランキング（H3, H4 内）

| ランク | 案 | 理由 |
|-------|---|------|
| 1 | H4.1.b Zotero Local API import | 認証不要・即価値・論文出力に直結 |
| 2 | H3.7.a Obsidian Vault 一括 import（移行用）| 既存資産活用、一度きりで OK |
| 3 | H3.5.d 並行運用（M3E が Vault を生成）| 長期運用に強い |
| 4 | H4.2.a + H4.4.b 文献+ハイライト集約 | UC-Z2 が回る |
| 5 | H4.5 引用記法サポート | H5 LaTeX export と接続 |
