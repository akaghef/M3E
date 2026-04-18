# Flash 入力パイプライン設計

作成日: 2026-04-10
作成者: data agent
ステータス: 設計提案（Akaghef による判断待ち）

---

## 1. 背景と目的

### 1.1 Flash バンドの位置づけ

M3E の 3 バンド構造（Flash / Rapid / Deep）において、Flash は「日常マルチモーダルキャプチャ」を担う。Band_Spec の定義:

- 閃き、割り込み、一時メモ
- 即応性を最優先
- 種を逃さない
- 当面は軽量なテキスト中心でよい

現在 Flash の実装はゼロ。Rapid バンドの基盤（ツリー操作、undo/redo、保存、AI subagent）は整っているが、「外部コンテンツを取り込んで構造化する」パイプラインが存在しない。

### 1.2 Mapify との対比

Mapify は「Anything into Mind Map with AI」を掲げ、URL/PDF/YouTube/音声/画像からワンクリックでマップを生成する。500 万ユーザーを持ち、この領域の UX はサチっている。

M3E が Mapify を模倣する必要はない。差別化軸は明確:

| 軸 | Mapify | M3E Flash |
|----|--------|-----------|
| AI 出力の扱い | 正本として即確定 | ドラフトとして提案、人間が確定 |
| データ主権 | クラウドのみ | ローカルファイル正本 |
| 構造の深度 | 要約マップ（浅い） | Rapid/Deep への昇格パスあり |
| 信頼度 | なし | confidence パラメータ付き |

Mapify の強みである「入力の多様性」は取り入れつつ、M3E の「AI は提案、人間が確定」原則で包む。

---

## 2. 入力ソースの優先順位

ユーザー（Akaghef: 科学研究者）にとっての価値順で並べる。

| 優先度 | 入力ソース | 理由 | 実装コスト |
|--------|-----------|------|-----------|
| P0 | テキスト貼り付け | 最も汎用。コピペで即投入。思考の種を逃さない | 低 |
| P1 | URL（Web ページ） | 論文サイト、ドキュメント、ブログの構造化。研究の日常動線 | 中 |
| P2 | PDF アップロード | 論文 PDF の構造化。研究者にとって最頻出フォーマット | 中 |
| P3 | Markdown ファイル | Plan B（.md 正本方式）との親和性。Obsidian vault からの取り込み | 低 |
| P4 | YouTube URL | 講義動画、カンファレンス録画の構造化 | 中 |
| P5 | 音声ファイル | ミーティング録音、ポッドキャスト。Whisper API 依存 | 高 |
| P6 | 画像（OCR） | ホワイトボード写真、手書きメモ。利用頻度は低い | 高 |

### フェーズ分割

- **Phase 1**: P0 (テキスト) + P3 (Markdown) -- 外部依存なし、即実装可能
- **Phase 2**: P1 (URL) + P2 (PDF) -- テキスト抽出ライブラリが必要
- **Phase 3**: P4 (YouTube) + P5 (音声) + P6 (画像) -- 外部 API 依存

---

## 3. パイプラインアーキテクチャ

### 3.1 全体フロー

```
入力ソース
    |
    v
[1. Extractor] --- ソース種別に応じたテキスト抽出
    |
    v
[2. Structurer] --- AI による構造化（linear-to-tree）
    |
    v
[3. Draft Store] --- ドラフトとして一時保存
    |
    v
[4. Preview] --- ブラウザ上でプレビュー表示
    |
    v
[5. Approve] --- ユーザーが確認・部分選択・承認
    |
    v
[6. Commit] --- 正本マップにノード群を追加
```

### 3.2 各ステップの詳細

#### Step 1: Extractor

ソース種別ごとに Extractor を切り替える。全 Extractor は共通の出力型 `ExtractedContent` を返す。

```typescript
interface ExtractedContent {
  sourceType: "text" | "url" | "pdf" | "markdown" | "youtube" | "audio" | "image";
  sourceRef: string;          // 元 URL、ファイルパス等
  title: string;              // 抽出されたタイトル（なければ空文字）
  plainText: string;          // 抽出されたプレーンテキスト
  metadata: Record<string, string>; // 著者、日付、URL 等
  extractedAt: string;        // ISO 8601
}
```

技術選定:

| ソース | ライブラリ候補 | 備考 |
|--------|--------------|------|
| テキスト | なし（そのまま） | |
| URL | `cheerio` + `node-fetch` | HTML パース。JavaScript レンダリングが必要なページは非対応（Phase 3 で Puppeteer 検討） |
| PDF | `pdf-parse` | テキスト抽出のみ。レイアウト再現は不要 |
| Markdown | 自前パーサー（ヘッダー階層 → ツリー） | .md のヘッダー構造がそのままツリーになる |
| YouTube | `youtube-transcript` | 字幕テキスト取得。API キー不要（公開字幕のみ） |
| 音声 | OpenAI Whisper API or `whisper.cpp` | 外部 API or ローカル推論 |
| 画像 | Anthropic Vision API (Claude) | Claude の vision 機能で OCR + 構造化を一発で行える |

#### Step 2: Structurer

`ExtractedContent.plainText` を受け取り、ツリー構造に変換する。

既存の `linear_agent.ts` の `linear-to-tree` 変換を再利用する。ただし Flash 用のプロンプトを新設する。

```typescript
interface StructuredDraft {
  nodes: DraftNode[];
  suggestedParentId: string | null; // 既存マップのどこに挿入するかの提案
}

interface DraftNode {
  tempId: string;
  parentTempId: string | null;
  text: string;
  details: string;
  note: string;
  confidence: number;         // 0.0 - 1.0
  sourceRef: string;          // ExtractedContent.sourceRef
  attributes: Record<string, string>;
}
```

Flash 用構造化プロンプトの方針:

- 過度に深い階層を作らない（最大 3-4 階層）
- 要約ではなく**キーポイントの抽出**
- 各ノードの `confidence` を AI に推定させる（事実 → 高、推論 → 中、憶測 → 低）
- ソースへの参照を保持する

#### Step 3: Draft Store

ドラフトは SQLite の専用テーブルに一時保存する。正本マップとは分離。

```sql
CREATE TABLE IF NOT EXISTS flash_drafts (
  id TEXT PRIMARY KEY,              -- UUID
  doc_id TEXT NOT NULL,             -- 対象ドキュメント ID
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  structured_json TEXT NOT NULL,    -- StructuredDraft の JSON
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | partial | rejected
  approved_node_ids TEXT,           -- 部分承認時のノード ID リスト（JSON 配列）
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

ドラフトの生存期間:

- `pending` のまま 7 日経過 → 自動削除（ゴミ溜めにしない）
- `approved` / `partial` → commit 済みなので参照用に 30 日保持
- `rejected` → 即削除

#### Step 4: Preview（Browser 側 -- スコープ外だが設計上の想定）

ブラウザ側（visual ロールの担当）で以下を実装する想定:

- ドラフトノードを半透明/点線で既存マップ上に重ねて表示
- 各ノードにチェックボックス（採用/不採用）
- confidence の高低を色で示す（緑 → 黄 → 赤）
- 一括承認 / 一括拒否ボタン
- ドラフトノードのテキスト編集（承認前に修正可能）

#### Step 5: Approve

ユーザーの承認操作を受け取り、選択されたノードを正本に commit する。

- 全体承認: ドラフト全ノードを正本に追加
- 部分承認: 選択されたノードのみ追加（親子関係の再計算が必要）
- 拒否: ドラフトを破棄

#### Step 6: Commit

承認されたノードを `RapidMvpModel.addNode()` で正本マップに追加する。

- `tempId` を正式な `n_` ID に変換
- `parentTempId` を実際の `parentId` に解決
- `attributes` に `flash:source` と `flash:confidence` を記録
- undo スタックに積む（一括 undo 可能）

---

## 4. 「AI は提案、人間が確定」の実現

### 4.1 Core Principle #5 との整合

> AI が勝手に正本を書き換えない。提案は差分として見える必要がある。採用判断は常に人間が行う。

Flash パイプラインでは以下のように実現する:

1. **AI 出力は必ず Draft Store に入る** -- 正本に直接書き込まない
2. **ドラフトは差分として可視化される** -- 既存マップとの対比が見える
3. **承認は明示的なユーザー操作** -- 自動承認モードは設けない
4. **部分承認が可能** -- AI の出力を全て受け入れる必要はない
5. **承認前の編集が可能** -- AI 提案をベースに人間が修正してから取り込む

### 4.2 Mapify との差別化

Mapify: `入力 → AI生成 → 即マップ（正本）`
M3E:    `入力 → AI生成 → ドラフト（提案）→ 人間確認 → 承認 → マップ（正本）`

この 1 ステップの差が M3E の信頼性の源泉になる。

### 4.3 UX 上のバランス

「人間が確定」を厳格にしすぎると Flash の「即応性」が損なわれる。バランス:

- ドラフト生成は非同期（バックグラウンド）で行い、完了通知を出す
- プレビューはワンクリックで表示
- 承認もワンクリック（全体承認ボタン）で可能
- 「AI の提案を見て、問題なければ即承認」が最短パス（2 クリック）

---

## 5. Flash → Rapid 昇格パス

### 5.1 confidence パラメータ

Flash で取り込んだノードには `attributes` に confidence を記録する:

```
flash:confidence = "0.3"   -- AI が推定した初期値
flash:source     = "url:https://example.com/paper.pdf"
flash:imported   = "2026-04-10T12:00:00Z"
```

### 5.2 confidence の変動

| アクション | confidence への影響 |
|-----------|-------------------|
| AI が生成した直後 | AI の推定値（0.1 - 0.7） |
| ユーザーが承認 | +0.2 |
| ユーザーがテキストを編集 | = 0.8（人間が内容を確認・修正した） |
| ユーザーが子ノードを追加 | 親の confidence +0.1 |
| 一定期間未参照 | 変動なし（自動減衰はしない） |

### 5.3 昇格の仕組み

- confidence >= 0.8 のノードは Rapid バンド相当とみなす
- UI 上で「この Flash ノード群は十分検証済みです。Rapid に昇格しますか？」と提案
- 昇格 = `flash:*` attributes の除去 + 通常ノードとしての扱い
- 昇格は手動トリガー（自動昇格はしない -- 原則 #5 に準拠）

### 5.4 将来の Deep 昇格

Rapid → Deep の昇格は Flash 設計のスコープ外だが、同じ confidence メカニズムの延長で設計可能。Deep では TCL (Tree Compatible Language) による形式化が昇格条件になる想定。

---

## 6. API 設計

### 6.1 エンドポイント一覧

| メソッド | パス | 概要 |
|----------|------|------|
| `POST` | `/api/flash/ingest` | 入力ソースを受け取りパイプライン開始 |
| `GET` | `/api/flash/drafts` | ドラフト一覧の取得 |
| `GET` | `/api/flash/draft/:id` | 特定ドラフトの取得 |
| `POST` | `/api/flash/draft/:id/approve` | ドラフトの承認（全体 or 部分） |
| `DELETE` | `/api/flash/draft/:id` | ドラフトの破棄 |

### 6.2 各エンドポイントの詳細

#### `POST /api/flash/ingest`

パイプラインを開始する。抽出 + 構造化は非同期で行い、即座に draft ID を返す。

リクエスト:

```json
{
  "docId": "rapid-main",
  "sourceType": "url",
  "content": "https://arxiv.org/abs/2401.12345",
  "options": {
    "maxDepth": 3,
    "language": "ja",
    "instruction": "数学的定義と定理に焦点を当てて構造化してください"
  }
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `docId` | string | Yes | 対象ドキュメント ID |
| `sourceType` | string | Yes | `"text"`, `"url"`, `"pdf"`, `"markdown"`, `"youtube"`, `"audio"`, `"image"` |
| `content` | string | Yes | テキスト本文、URL、またはファイルパス |
| `options.maxDepth` | number | No | 構造化の最大階層数（既定: 4） |
| `options.language` | string | No | 出力言語（既定: 入力言語を維持） |
| `options.instruction` | string | No | AI への追加指示 |
| `options.targetNodeId` | string | No | 挿入先ノード ID（省略時は AI が提案） |

成功レスポンス (202 Accepted):

```json
{
  "ok": true,
  "draftId": "d_1775650869381_abc123",
  "status": "extracting",
  "message": "Pipeline started. Poll GET /api/flash/draft/:id for results."
}
```

ステータス遷移: `extracting` → `structuring` → `pending` → (`approved` | `partial` | `rejected`)

#### `GET /api/flash/drafts`

クエリパラメータ:

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `docId` | string | ドキュメント ID でフィルタ |
| `status` | string | ステータスでフィルタ（`pending`, `approved` 等） |

レスポンス (200):

```json
{
  "ok": true,
  "drafts": [
    {
      "id": "d_1775650869381_abc123",
      "docId": "rapid-main",
      "sourceType": "url",
      "sourceRef": "https://arxiv.org/abs/2401.12345",
      "title": "Attention Is All You Need (v2)",
      "nodeCount": 12,
      "status": "pending",
      "createdAt": "2026-04-10T12:00:00Z"
    }
  ]
}
```

#### `GET /api/flash/draft/:id`

レスポンス (200):

```json
{
  "ok": true,
  "draft": {
    "id": "d_1775650869381_abc123",
    "docId": "rapid-main",
    "sourceType": "url",
    "sourceRef": "https://arxiv.org/abs/2401.12345",
    "status": "pending",
    "extractedText": "...(抽出されたプレーンテキスト)...",
    "structured": {
      "nodes": [
        {
          "tempId": "t_001",
          "parentTempId": null,
          "text": "Attention Is All You Need",
          "details": "",
          "note": "Vaswani et al., 2017",
          "confidence": 0.9,
          "sourceRef": "https://arxiv.org/abs/2401.12345",
          "attributes": {}
        },
        {
          "tempId": "t_002",
          "parentTempId": "t_001",
          "text": "Self-Attention Mechanism",
          "details": "Query, Key, Value の内積で注意重みを計算",
          "note": "",
          "confidence": 0.8,
          "sourceRef": "https://arxiv.org/abs/2401.12345#section-3",
          "attributes": {}
        }
      ],
      "suggestedParentId": "n_1775547979694_t8k38i"
    },
    "createdAt": "2026-04-10T12:00:00Z",
    "updatedAt": "2026-04-10T12:00:05Z"
  }
}
```

#### `POST /api/flash/draft/:id/approve`

リクエスト:

```json
{
  "mode": "partial",
  "selectedNodeIds": ["t_001", "t_002", "t_005"],
  "targetParentId": "n_existing_node_id",
  "edits": {
    "t_002": {
      "text": "Self-Attention（自己注意機構）"
    }
  }
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `mode` | string | Yes | `"all"` (全承認) or `"partial"` (部分承認) |
| `selectedNodeIds` | string[] | `partial` 時のみ | 承認するノードの tempId リスト |
| `targetParentId` | string | No | 挿入先の正本ノード ID（省略時は suggestedParentId） |
| `edits` | object | No | 承認前のテキスト修正。キーは tempId |

成功レスポンス (200):

```json
{
  "ok": true,
  "committedNodeIds": ["n_1775650900000_xyz789", "n_1775650900001_def456"],
  "parentId": "n_existing_node_id",
  "message": "2 nodes committed to rapid-main"
}
```

#### `DELETE /api/flash/draft/:id`

レスポンス (200):

```json
{
  "ok": true,
  "message": "Draft d_1775650869381_abc123 deleted"
}
```

---

## 7. Plan B（.md 正本方式）との整合

### 7.1 現状

Plan B（単一正本方式）が採用決定済み。.md が唯一の正本、SQLite はキャッシュ/インデックス。

### 7.2 Flash データの保存先

Flash で取り込んだデータは以下のように .md ファイルとして保存する:

```
{M3E_DATA_DIR}/
  vault/
    _inbox/                    -- Flash 未整理データの置き場
      2026-04-10_arxiv_2401.12345.md
      2026-04-10_meeting_notes.md
    _drafts/                   -- AI 構造化結果のドラフト
      d_1775650869381_abc123.json
    topics/                    -- 承認済みノードが所属するフォルダ
      mathematics/
      machine-learning/
```

### 7.3 _inbox フォルダの役割

- Flash の Extractor が出力した `ExtractedContent` をそのまま .md として保存
- frontmatter に source 情報を記録

```markdown
---
source_type: url
source_ref: https://arxiv.org/abs/2401.12345
extracted_at: 2026-04-10T12:00:00Z
flash_status: pending
---

# Attention Is All You Need

(抽出されたテキスト本文)
```

### 7.4 承認後のフロー

1. ユーザーがドラフトを承認
2. 承認されたノードが正本マップに追加される
3. _inbox の .md は `flash_status: committed` に更新
4. ノードの `attributes.flash:source` から元の .md を参照可能
5. _inbox の .md は参照用に保持（ソーストレーサビリティ）

### 7.5 将来: Obsidian 連携

_inbox フォルダを Obsidian vault 内に配置すれば、Obsidian で Flash データを直接閲覧・編集できる。Plan B の「.md 正本方式」との自然な統合が可能。

---

## 8. 実装計画

### Phase 1: テキスト + Markdown（目標: 1 週間）

実装範囲:

- `flash_pipeline.ts` -- パイプラインコア（Extractor 共通インターフェース）
- `flash_extractors.ts` -- テキスト / Markdown Extractor
- `flash_draft_store.ts` -- SQLite ドラフトテーブル
- `start_viewer.ts` -- Flash API エンドポイント 5 本
- `types.ts` -- Flash 関連の型定義追加

依存パッケージ: なし（Node.js 標準のみ）

### Phase 2: URL + PDF（目標: 1 週間）

追加実装:

- `flash_extractors.ts` に URL / PDF Extractor 追加
- `cheerio`, `node-fetch`, `pdf-parse` を devDependencies に追加
- AI 構造化プロンプトの調整（長文対応）

### Phase 3: YouTube + 音声 + 画像（目標: 2 週間）

追加実装:

- `youtube-transcript` パッケージ
- Whisper API 連携 or whisper.cpp バインディング
- Claude Vision API 連携（画像 → 構造化を一発で行う）
- ai_infra.ts への Anthropic transport 追加が前提

---

## 9. 設計判断が必要な点

以下の点は Akaghef の判断を仰ぐ。

### 9.1 ドラフトプレビューの UI パターン

- **A. オーバーレイ方式**: 既存マップ上にドラフトノードを半透明で重ねる
- **B. サイドパネル方式**: マップの横にドラフトツリーを表示し、ドラッグで取り込む
- **C. 専用ビュー方式**: Flash 専用の画面でプレビュー、承認後にマップに反映

推奨: **A** -- 既存マップとの関係が直感的に見える。ただし実装は visual ロールの担当。

### 9.2 AI 構造化の粒度設定

- ユーザーが構造化の粒度（概要/標準/詳細）を選べるようにするか
- あるいは AI に任せて、承認時にユーザーが間引くか

推奨: Phase 1 では AI に任せる。粒度オプションは Phase 2 以降の UX フィードバック次第。

### 9.3 バッチ ingest

- 複数 URL / 複数 PDF を一括で投入する機能は Phase 1 から必要か
- あるいは 1 件ずつ投入で十分か

推奨: Phase 1 は 1 件ずつ。バッチは需要を見て Phase 2 以降。

### 9.4 confidence の表現方法

- `attributes` に文字列として保存（`"flash:confidence": "0.7"`）
- TreeNode に `confidence` フィールドを追加（型変更、影響範囲大）

推奨: Phase 1 は `attributes` 方式（型変更なし、互換性維持）。TreeNode への昇格は Band_Spec の正式策定時に判断。

---

## 10. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| AI 構造化の品質が低い | ドラフトが使い物にならない | プロンプトの反復改善 + 人間確認ステップがバッファ |
| ドラフトが溜まりすぎる | _inbox がゴミ箱化 | 7 日自動削除 + UI でのドラフト一覧表示 |
| URL 抽出が JS レンダリングページに対応できない | SPA サイトのコンテンツが取れない | Phase 3 で Puppeteer 導入を検討 |
| PDF 抽出の精度（表、数式） | 論文の重要部分が欠落 | pdf-parse の限界を明示し、代替ライブラリ評価を Phase 2 で実施 |
| 部分承認時の親子関係の再計算 | 中間ノードを飛ばすと孤児ノードが発生 | 選択されたノードの先祖を自動補完するロジックを実装 |

---

## 情報ソース

- [Band_Spec.md](../03_Spec/Band_Spec.md)
- [Core_Principles.md](../01_Vision/Core_Principles.md)
- [REST_API.md](../03_Spec/REST_API.md)
- [AI Integration Architecture](260410_ai_integration_architecture.md)
- [Local Binding Design](260410_local_binding_design.md)
- [Mapify 競合調査](../competitive_research/mapify.md)
- [Scalable Knowledge Base Vision](260410_scalable_knowledge_base_vision.md)
