# Flash バンド: データモデルと UX フロー設計

最終更新: 2026-04-10
ステータス: 設計提案（Akaghef 判断待ち）
担当: data2

---

## 0. 前提と設計原則

- Flash は「日常マルチモーダルキャプチャ」。構造は後付け
- M3E の差別化: 「AI は提案、人間が確定」-- confidence による段階的信頼構築
- Plan B（.md 単一正本）との整合を最優先する
- 既存 TreeNode / RapidMvpModel を壊さない。attributes フィールドへの拡張で対応する

---

## 1. Flash ノードのデータモデル

### 1.1 方針: attributes フィールドに格納する

TreeNode は `attributes: Record<string, string>` を持つ。Flash 固有のメタデータはここに格納する。

**理由:**
- TreeNode 型に専用フィールドを追加すると validate() の整合性に影響する
- attributes は汎用 KV なので、Flash / Rapid / Deep 全バンドで使える
- JSON round-trip が安全（string-only なので型変換の問題がない）
- .md frontmatter への退避も attributes をそのまま YAML に書けば済む

**不採用案: 専用フィールド追加**
- TreeNode に `band?: "flash" | "rapid" | "deep"` 等を追加する案
- validate() の改修、fromJSON の互換性、既存データのマイグレーション等のコストが大きい
- 将来的に band 判定が複雑化した場合にのみ再検討する

### 1.2 Flash attributes のスキーマ

```typescript
// attributes に格納する Flash 固有キー（全て string 値）
// prefix "m3e:" で名前空間を分離し、ユーザー定義 attributes との衝突を防ぐ

const FLASH_ATTRIBUTE_KEYS = {
  BAND:         "m3e:band",           // "flash" | "rapid" | "deep"
  SOURCE_TYPE:  "m3e:sourceType",     // "url" | "pdf" | "text" | "audio" | "image" | "youtube"
  SOURCE_URL:   "m3e:sourceUrl",      // 元ソースの URL（任意）
  CAPTURED_AT:  "m3e:capturedAt",     // ISO 8601 日時文字列
  CONFIDENCE:   "m3e:confidence",     // "0.0" - "1.0"（string で格納、使用時にparseFloat）
  STATUS:       "m3e:status",         // "draft" | "reviewed" | "promoted"
  PROMOTED_TO:  "m3e:promotedTo",     // "rapid" | "deep"（昇格済みの場合のみ）
  REVIEWED_AT:  "m3e:reviewedAt",     // レビュー日時
  REVIEWED_BY:  "m3e:reviewedBy",     // レビュー者（チーム利用時）
} as const;
```

### 1.3 TreeNode 使用例

```typescript
const flashNode: TreeNode = {
  id: "n_1712745600_abc123",
  parentId: "n_inbox_root",
  children: [],
  nodeType: "text",                     // 既存の nodeType をそのまま使用
  text: "面白い論文: Attention Is All You Need",
  collapsed: false,
  details: "Transformer アーキテクチャの基礎論文。...",
  note: "",
  attributes: {
    "m3e:band": "flash",
    "m3e:sourceType": "pdf",
    "m3e:sourceUrl": "https://arxiv.org/abs/1706.03762",
    "m3e:capturedAt": "2026-04-10T14:30:00Z",
    "m3e:confidence": "0.3",            // AI 生成の初期値
    "m3e:status": "draft",
  },
  link: "https://arxiv.org/abs/1706.03762",
};
```

### 1.4 .md frontmatter への退避（Plan B 整合）

```yaml
---
m3e:
  nodeId: "n_1712745600_abc123"
  nodeType: "text"
  band: "flash"
  sourceType: "pdf"
  sourceUrl: "https://arxiv.org/abs/1706.03762"
  capturedAt: "2026-04-10T14:30:00Z"
  confidence: 0.3
  status: "draft"
---

# 面白い論文: Attention Is All You Need

Transformer アーキテクチャの基礎論文。...
```

- frontmatter の `m3e:` ネームスペース内に Flash 属性を格納する
- confidence は frontmatter では数値型で保持可能（YAML は型付き）
- attributes の `m3e:` prefix は frontmatter 書き出し時に `m3e:` namespace に統合する

---

## 2. Flash のライフサイクル

### 2.1 状態遷移図

```
                  ┌──────────────────────────┐
                  │                          │
  取り込み ──→ [draft] ──→ [reviewed] ──→ [promoted]
                  │              │              │
                  │              │              ├──→ Rapid
                  │              │              └──→ Deep
                  │              │
                  └──→ [archived]  (明示的にアーカイブ)
                       └──→ [deleted]  (ゴミ箱)
```

### 2.2 各状態の定義

| 状態 | m3e:status | 意味 | 遷移条件 |
|------|-----------|------|---------|
| ドラフト | `draft` | 取り込み直後。AI が構造化した、または手動入力した | 取り込み時に自動設定 |
| レビュー済み | `reviewed` | ユーザーが内容を確認・編集した | ユーザーが明示的に「確認」操作、またはノード編集時 |
| 昇格済み | `promoted` | Rapid / Deep に移動した | confidence 閾値到達 + ユーザー承認、または手動昇格 |
| アーカイブ | `archived` | 不要だが削除はしない | ユーザーが明示的にアーカイブ |

### 2.3 状態遷移トリガー

| 遷移 | トリガー | 自動/手動 |
|------|---------|----------|
| (新規) -> draft | 取り込みパイプライン完了 | 自動 |
| draft -> reviewed | ユーザーがノードを開いて確認ボタンを押す | 手動 |
| draft -> reviewed | ユーザーがノードのテキストを編集 | 自動（編集 = 確認とみなす） |
| reviewed -> promoted | confidence >= 閾値 && ユーザーが昇格を承認 | 半自動（提案 + 承認） |
| reviewed -> promoted | ユーザーが明示的に「Rapid に昇格」を実行 | 手動 |
| any -> archived | ユーザーが「アーカイブ」操作 | 手動 |

---

## 3. 信頼度（confidence）モデル

### 3.1 初期値

| 取り込み方法 | 初期 confidence | 理由 |
|-------------|----------------|------|
| AI 自動生成（URL, PDF 等） | 0.3 | AI の構造化は未検証 |
| AI 補助 + ユーザー修正 | 0.5 | ユーザーが関与しているが完全な確認ではない |
| 完全手動入力 | 0.7 | ユーザーが自ら入力 = 一定の信頼性 |

### 3.2 confidence 変動ルール

| イベント | 変動 | 上限 | 備考 |
|---------|------|------|------|
| ユーザーが「確認」ボタンを押す | +0.2 | 1.0 | draft -> reviewed 遷移時 |
| ユーザーがテキストを編集 | +0.1 | 1.0 | 編集 = 内容を理解した上での修正 |
| 他ノードから参照（alias/link） | +0.05 | 1.0 | 引用 = 価値があるという間接的証拠 |
| 他ユーザーが引用（チーム利用） | +0.1 | 1.0 | 他者の検証 = より強い信頼性 |
| ユーザーが「信頼度リセット」 | -> 0.3 | - | 内容が古くなった場合など |

### 3.3 時間減衰

**設計判断: 初期実装では時間減衰を入れない。**

理由:
- Flash は「キャプチャ」であり、キャプチャ時点の情報は時間が経っても変わらない
- 減衰が必要なのは「主張・仮説」であり、それは Deep バンドの領域
- 減衰ロジックはバックグラウンドジョブが必要で、初期実装の複雑度を上げる
- 将来 Deep バンド設計時に temperature パラメータとして実装する方が自然

### 3.4 昇格閾値

| 昇格先 | 必要 confidence | 必要 status | 追加条件 |
|--------|----------------|-------------|---------|
| Rapid | >= 0.7 | reviewed | なし |
| Deep | >= 0.9 | reviewed | evidence（根拠）の記載あり |

- 閾値到達で自動昇格はしない。ユーザーに「昇格しますか？」と提案する
- ユーザーが閾値未満でも手動昇格できる（confidence は維持される）

---

## 4. Flash -> Rapid 昇格の UX フロー

### 4.1 自動提案フロー

```
1. ユーザーが Flash ノードを編集/確認
   ↓
2. confidence 再計算
   ↓
3. confidence >= 0.7 && status == "reviewed"
   ↓
4. 通知バッジを表示:
   「このノードは Rapid に昇格できます」
   [昇格する] [後で] [このノードでは提案しない]
   ↓
5a. [昇格する] → 昇格ダイアログを表示（Section 4.3）
5b. [後で] → 通知を閉じる（次回 confidence 変動時に再提案）
5c. [提案しない] → attributes に "m3e:suppressPromotion": "true" を設定
```

### 4.2 手動昇格フロー

```
1. ユーザーが Flash ノードを右クリック / コンテキストメニュー
   ↓
2. 「Rapid に昇格」/「Deep に昇格」を選択
   ↓
3. 昇格ダイアログを表示（Section 4.3）
```

### 4.3 昇格ダイアログ

```
┌─────────────────────────────────────────────┐
│  Flash → Rapid 昇格                         │
├─────────────────────────────────────────────┤
│                                             │
│  ノード: "Attention Is All You Need"        │
│  現在の confidence: 0.8                     │
│                                             │
│  昇格先:                                    │
│  ○ Rapid（業務グラフ構造）                  │
│  ○ Deep （研究オントロジー）                │
│                                             │
│  配置先:                                    │
│  [既存スコープを選択 ▼] or [新規スコープ]   │
│                                             │
│  □ AI に構造リファクタを提案させる           │
│    (子ノードの再構成、関連ノードとのリンク)  │
│                                             │
│          [昇格する]  [キャンセル]             │
└─────────────────────────────────────────────┘
```

### 4.4 昇格時の処理

```
1. attributes 更新:
   - "m3e:band": "flash" → "rapid" (or "deep")
   - "m3e:status": "promoted"
   - "m3e:promotedTo": "rapid" (or "deep")

2. ノード移動:
   - parentId を新しいスコープの適切な位置に変更
   - reparentNode() を使用

3. (オプション) AI 構造リファクタ:
   - 既存の AiSubagent を使い、昇格先スコープの文脈で再構造化を提案
   - mode: "proposal" で提案し、ユーザーが承認してから適用

4. .md ファイル操作（Plan B）:
   - 元の _flash/ フォルダから .md ファイルを移動
   - 移動先スコープのフォルダに配置
   - frontmatter を更新
```

---

## 5. Flash の保存先（Plan B 整合）

### 5.1 推奨: `_flash/` フォルダ + 日付サブフォルダ

```
Vault Root/
├── _flash/                          ← Flash 専用フォルダ
│   ├── _folder.md                   ← Flash ルートのメタデータ
│   ├── 2026-04-10/                  ← 日付ベースのサブフォルダ
│   │   ├── attention-is-all.md      ← 取り込んだノード
│   │   ├── meeting-notes-pm.md
│   │   └── screenshot-whiteboard.md
│   ├── 2026-04-11/
│   │   └── ...
│   └── _archived/                   ← アーカイブされた Flash
│       └── old-note.md
├── research/                        ← Rapid / Deep のスコープ
│   └── ...
└── projects/
    └── ...
```

**理由:**

| 案 | メリット | デメリット | 判定 |
|----|---------|----------|------|
| `_inbox/` | Inbox メタファーが直感的 | Inbox は「処理待ち」の意味が強く、reviewed でも残るのが違和感 | 不採用 |
| `_flash/` | バンド名と一致。M3E 用語との整合性が高い | Obsidian ユーザーには馴染みがない | **採用** |
| 日付フォルダのみ (`2026/04/10/`) | 時系列で自然 | Flash 以外のノードと混在する | 不採用 |
| ルート直下に混在 | フォルダ構造がシンプル | Flash が大量になるとノイズ | 不採用 |

### 5.2 日付サブフォルダの粒度

- 日単位 (`2026-04-10/`) を採用
- 月単位 (`2026-04/`) だとファイル数が多くなりすぎる
- `_flash/` 直下にフラットに置く案もあるが、100件を超えるとナビゲーションが困難

### 5.3 昇格時のファイル移動

```
昇格前: _flash/2026-04-10/attention-is-all.md
昇格後: research/ml-foundations/attention-is-all.md
```

- 昇格ダイアログで配置先スコープを選ぶ → 対応するフォルダに .md を移動
- FileBinding Layer の `BindingManager.moveFile()` で処理
- 移動後は wikilink (`[[attention-is-all]]`) が壊れる可能性がある
  - 対策: 移動時に旧パスからのリダイレクト情報を残す（Obsidian の alias 機能と同等）

### 5.4 ファイル命名規則

```
{sanitized-title}.md
```

- ノードの text からファイル名を生成（スペース → ハイフン、特殊文字除去）
- 重複時は `-2`, `-3` のサフィックス
- nodeId はファイル名に含めない（frontmatter で管理）

---

## 6. Flash の表示（既存 viewer との統合）

### 6.1 推奨: 専用 Inbox ビュー + ツリー内混在のハイブリッド

**Inbox ビュー（新規）:**
- `_flash/` フォルダの内容を時系列で表示する専用パネル
- ドラフト → レビュー済み → 昇格候補 の3セクションに分類
- ワンクリックで確認（reviewed に遷移）
- ドラッグ&ドロップで任意のスコープに昇格

**ツリービュー（既存）:**
- Flash ノードもツリー内に表示される（`_flash/` はスコープの一つ）
- ただし、draft 状態のノードは視覚的に区別する

### 6.2 ドラフト状態の見た目

| 状態 | 視覚表現 | CSS 案 |
|------|---------|--------|
| draft | テキスト色を薄く + 左ボーダー（青い点線） | `opacity: 0.6; border-left: 2px dashed #60a5fa;` |
| reviewed | 通常表示 + 小さな確認バッジ | バッジアイコン |
| promoted | 通常表示（昇格先バンドの表現に従う） | - |
| archived | 非表示（フィルターで表示可能） | `display: none` (default) |

### 6.3 confidence の表示

- ノードの右端に小さなバー or 数値で表示
- 色グラデーション: 赤(0.0) → 黄(0.5) → 緑(1.0)
- ツリービューではホバー時のみ表示（情報過多を防ぐ）
- Inbox ビューでは常時表示

### 6.4 バンドバッジ

ノードがどのバンドに属するかを示す小さなアイコン/ラベル:

| バンド | バッジ | 色 |
|--------|--------|-----|
| Flash | "F" or 稲妻アイコン | 青 (#60a5fa) |
| Rapid | "R" or フロー図アイコン | 緑 (#34d399) |
| Deep | "D" or 構造アイコン | 紫 (#a78bfa) |

---

## 7. ヘルパー関数の設計

attributes ベースのデータモデルを扱うためのヘルパー関数群。
`beta/src/shared/flash_helpers.ts`（新規）に配置する。

```typescript
// --- 型定義 ---

type Band = "flash" | "rapid" | "deep";
type FlashSourceType = "url" | "pdf" | "text" | "audio" | "image" | "youtube";
type FlashStatus = "draft" | "reviewed" | "promoted" | "archived";

// --- 読み取り ---

function getBand(node: TreeNode): Band | null;
function getConfidence(node: TreeNode): number | null;
function getFlashStatus(node: TreeNode): FlashStatus | null;
function isFlashNode(node: TreeNode): boolean;
function isPromotionCandidate(node: TreeNode, targetBand: "rapid" | "deep"): boolean;

// --- 書き込み ---

function initFlashAttributes(node: TreeNode, sourceType: FlashSourceType, isAiGenerated: boolean): void;
function markReviewed(node: TreeNode): void;
function adjustConfidence(node: TreeNode, delta: number): void;
function promoteNode(node: TreeNode, targetBand: "rapid" | "deep"): void;
```

---

## 8. Mapify との差別化ポイント

| 観点 | Mapify | M3E Flash |
|------|--------|-----------|
| AI 出力の扱い | 正本（即確定） | ドラフト（confidence 0.3） |
| ユーザーの役割 | AI 出力の消費者 | AI 出力の検証者・編集者 |
| 信頼度 | なし | confidence 0.0-1.0 |
| 昇格パス | なし（フラット） | Flash -> Rapid -> Deep |
| データ正本 | クラウド DB | .md ファイル（Plan B） |
| オフライン | 不可 | 完全対応 |
| チーム利用 | なし | PI=Deep, 学生=Flash の分業 |

---

## 9. data1 入力パイプラインとの接続点

data1 が設計する入力パイプラインとの接続インターフェース:

```typescript
// data1 の入力パイプラインが出力する中間データ
interface FlashCaptureResult {
  text: string;                    // ノードテキスト
  details: string;                 // 詳細（AI 要約等）
  sourceType: FlashSourceType;     // 取り込み元の種別
  sourceUrl?: string;              // 元 URL
  children?: FlashCaptureResult[]; // AI が構造化した子ノード
  isAiGenerated: boolean;          // AI 生成フラグ
}

// data2 側の受け入れ関数
function createFlashNodes(
  model: RapidMvpModel,
  parentId: string,               // _flash/{date}/ の対応ノードID
  captures: FlashCaptureResult[],
): string[];                       // 作成されたノードIDの配列
```

- data1 は `FlashCaptureResult` を生成するまでを担当
- data2 は `createFlashNodes()` で TreeNode 化 + attributes 設定 + .md 書き出しを担当
- この境界は後で data1 と合意する

---

## 10. 未決事項（Akaghef 判断待ち）

1. **`_flash/` フォルダ名**: `_flash/` で進めてよいか。代替案: `_inbox/`, `_capture/`, `flash/`（アンダースコアなし）

2. **日付サブフォルダ**: 日単位で進めてよいか。代替案: 月単位、フラット

3. **Inbox ビュー**: 専用パネルとして実装するか、既存ツリービューのフィルタで代用するか

4. **confidence 変動値**: Section 3.2 の数値は仮置き。実運用データを見て調整が必要

5. **バンドバッジのデザイン**: テキスト ("F"/"R"/"D") かアイコンか

6. **手動昇格時の confidence 制約**: 閾値未満でも手動昇格を許可するか（現設計: 許可）

7. **アーカイブの扱い**: archived ノードを .md ファイルとして残すか、別の保存形式にするか

---

## 11. 実装優先度

| 優先度 | 項目 | 依存 |
|--------|------|------|
| P0 | Flash attributes スキーマ + ヘルパー関数 | なし |
| P0 | createFlashNodes() | data1 パイプラインの出力形式 |
| P1 | `_flash/` フォルダの .md 書き出し | Plan B FileBinding Layer |
| P1 | confidence 計算ロジック | なし |
| P2 | 昇格フロー（手動） | Rapid スコープの存在 |
| P2 | Inbox ビュー | browser 側担当（visual チーム） |
| P3 | 自動昇格提案 | confidence 計算 + 通知 UI |
| P3 | AI 構造リファクタ提案 | AiSubagent |
