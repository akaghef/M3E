# AI連携仕様

最終更新: 2026-04-02

---

## 基本原則

Core Principles §5 に従う。

- **AI は提案、人間が確定**。AI がユーザーの許可なく正本を書き換えることはない
- 提案は差分として可視化し、採用・棄却を明示的に選択する
- AI は外部依存であり、オフライン時も M3E の基本機能は成立する
- API へ送信するデータ範囲はユーザーが把握・制御できる

---

## 文書の役割

- 本文書: AI 機能の導入段階、feature 要件、承認フロー
- `../04_Architecture/AI_Infrastructure.md`: provider 接続、secret 注入、transport、責務分離
- `./AI_Common_API.md`: 共通 API 契約、error code、proposal/result 正規形

AI インフラの共通設計は上記 architecture 文書を正本とし、
本書では feature 側の仕様と段階導入に集中する。

---

## 連携フェーズ

### Phase 0（現行）— 手動コンテクスト出力

ユーザーが手動でノード構造を外部 AI（Claude, ChatGPT 等）に貼り付けて対話する。
M3E 側の実装は不要だが、**エクスポート品質**が連携の質を左右する。

対応タスク:
- Markdown エクスポート（インデント形式ツリー）
- JSON エクスポート（完全構造）
- コンテクストパッケージ（選択スコープ以下を自然言語化して圧縮した出力）

---

### Phase 1 — コンテクストパッケージ生成（Deep 連携）

選択したスコープ以下の構造を、外部 AI に渡すためのテキストに変換する機能。

#### 出力形式

```
[スコープ名] についての構造化コンテクスト

# 主要ノード（階層）
- 仮説A
  - 前提1
  - 前提2
- 仮説B
  ...

# 未整理メモ（Flash/Inbox）
- ...

# 関連外部参照（alias）
- [alias名] → [参照先スコープ名]
```

#### 設計要件

- 深さ・幅の上限を指定できる（コンテクスト長制御）
- 未整理の Flash アイテム（Inbox）を区別して含める
- alias は参照先名称だけを示し、実体データは含めない
- 出力をクリップボードにコピーするアクションをワンステップで実行できる

#### UI

- 右クリックメニュー or ツールバーボタン「コンテクスト生成」
- 生成プレビュー（モーダル）→ コピー or ファイル保存

---

### Phase 2 — Flash→Rapid 昇格支援

Flash の Inbox にある種を Rapid 構造へ組み込む際の配置候補提案。

#### 機能

| 提案内容 | 説明 |
|---------|------|
| 親候補提示 | 既存ノードの中から親として適切なノードを複数提案 |
| フォルダ候補提示 | 所属スコープの候補を提案 |
| タイトル整形 | 口語・断片テキストを簡潔なノードラベルに整形 |
| 重複検出 | 既存ノードと意味的に重複している場合に警告 |

#### 承認フロー

```
Inbox アイテム選択
  → [昇格] ボタン
  → AI 提案パネルが表示（親候補リスト・整形タイトル）
  → ユーザーが候補を選択 or 手入力
  → 確定 → 構造に追加
```

- AI 提案をスキップして手動昇格も常に可能
- 提案は「候補」として表示し、自動適用しない

---

### Phase 3 — インライン構造提案（Rapid 支援）

Rapid 帯域での編集中に、構造改善の提案を差分として表示する。

#### 提案種別

| 種別 | 内容 |
|-----|------|
| 分割提案 | 長すぎるノードを複数ノードに分割 |
| 統合提案 | 類似ノードのまとめ |
| 順序提案 | 兄弟ノードの並び替え（論理的順序） |
| 親付け替え提案 | 誤配置ノードの再配置候補 |

#### 差分表示

- 提案は現在のツリーの上に「ghosted overlay」として表示
- 変更対象ノードが色分け（追加: 緑、削除: 赤、移動: 黄）
- 「採用」「棄却」「後で確認」の 3 択で応答
- 部分採用（提案の一部だけ適用）が可能

---

### Phase 4 — Deep コンテクスト往復（将来）

Deep 構造を外部 AI に送り、AI の返答を差分として取り込む双方向連携。

#### フロー（概念）

```
Deep 構造 → コンテクストパッケージ生成
  → AI API に送信（ユーザー確認後）
  → AI 返答（テキスト or 構造化 JSON）
  → M3E が差分として解釈
  → ユーザーが採用・棄却を選択
  → 採用分だけ構造に反映
```

#### 前提条件

- Phase 1 のコンテクストパッケージが安定していること
- AI 返答の構造化解釈（JSON スキーマ合意）
- 差分表示 UI（Phase 3）が実装済みであること

---

## API 設計方針

### ローカル API サーバー経由

M3E の Node.js サーバーが AI API のプロキシとして振る舞う。
ブラウザから直接外部 API を叩かない（CORS・キー管理のため）。

```
Browser → localhost API → Claude API (or local LLM)
```

### エンドポイント（Phase 2 以降）

| エンドポイント | 説明 |
|-------------|------|
| `POST /api/ai/promote-suggestion` | Flash 昇格候補の取得 |
| `POST /api/ai/structure-proposal` | 構造改善提案の取得 |
| `POST /api/ai/context-package` | コンテクストパッケージ生成 |

### Provider 抽象化（DeepSeek subagent 対応）

外部 LLM 連携は provider 依存を避けるため、M3E 内部では共通インターフェースを使う。
DeepSeek はその 1 provider として実装し、map 内補助は subagent 呼び出しとして扱う。

#### 目的

- map 編集体験を壊さずに、補助機能を「提案」として段階導入する
- provider 切替（DeepSeek / Claude / local LLM）を UI と API 契約から分離する
- 送信範囲・承認フロー・監査ログを provider 横断で統一する

#### 非目的

- AI による無承認の正本更新
- provider 固有 SDK を browser 側に直接埋め込むこと
- 1 回の呼び出しで複数スコープ全体を書き換えること

#### Subagent の責務（初期スコープ）

| subagent | 入力 | 出力 | map 反映 |
|---|---|---|---|
| `suggest-parent` | 対象ノード + 候補親集合 | 親候補ランキング | ユーザー承認後のみ |
| `title-rewrite` | ノード text/details | 整形タイトル候補 | ユーザー承認後のみ |
| `duplicate-check` | 対象ノード + 近傍ノード | 重複警告/類似候補 | 警告のみ |
| `outline-expand` | 選択スコープ | 子ノード案（差分） | 差分採用時のみ |

#### 共通 API 契約（案）

詳細は `./AI_Common_API.md` を正本とする。

本書では次の原則のみ固定する。

- subagent 実行は `POST /api/ai/subagent/:name`
- provider 差分は server 側で吸収する
- AI 返答は proposal/result の正規形に落として返す
- approval 要否は response に明示する

#### DeepSeek provider 設定（現行方針）

- 環境変数
  - `M3E_AI_PROVIDER=deepseek`
  - `M3E_AI_API_KEY`
  - `M3E_AI_BASE_URL`（省略時は公式 URL）
  - `M3E_AI_MODEL`
- キー未設定時は fail-closed（subagent 機能を無効化して UI で通知）

#### 安全設計（Command Panel 方針との整合）

- 入力制限
  - subagent は `scopeId` 配下だけを参照可能
  - 最大ノード数・最大文字数を超える入力は送信前に拒否
- 出力制限
  - 返答は構造化 JSON のみ受理（自由文は説明欄に隔離）
  - 未知フィールドは破棄し、必須フィールド不足時は reject
- 実行制限
  - タイムアウト、リトライ回数、レート制限を provider 横断で適用
  - 失敗時は既存編集フローへ即時フォールバック（fail-closed）

#### 監査ログ（ローカル保存）

- 最低限の記録項目
  - timestamp / documentId / scopeId / subagent / provider
  - request hash（生データ全文は既定で保存しない）
  - result code / latency / token usage
  - user action（accept/reject/partial）

#### 段階導入計画

1. Provider 抽象 API を追加（実体は既存 provider 1 つで可）
2. `title-rewrite` と `duplicate-check` から導入
3. 差分 UI と承認イベントのログ化
4. DeepSeek provider を追加し A/B 切替
5. `suggest-parent` / `outline-expand` を順次有効化

### API キー管理

- キーはサーバーサイドの環境変数（`M3E_AI_API_KEY`）として保持
- ブラウザには送出しない
- キー未設定時は AI 機能を無効化し、その旨を UI に表示

---

## プライバシー設計

- **送信範囲の明示**: AI API に送るデータ（テキスト・構造）を送信前にユーザーに提示する
- **スコープ単位制御**: 特定スコープを「AI 送信対象外」にマークできる（将来）
- **ローカル LLM 対応**: API エンドポイントを差し替えることでオンプレミス LLM にも対応できる設計とする
- **送信ログ**: 何を送信したかをローカルに記録する（オプション）

---

## 実装優先順位

| Phase | 内容 | 依存 | 優先度 |
|-------|------|------|--------|
| 0 | Markdown/JSON エクスポート強化 | なし | **今すぐ着手可能** |
| 1 | コンテクストパッケージ生成 | エクスポート | Beta 安定後 |
| 2 | Flash→Rapid 昇格支援 | Flash UI, API proxy | Phase 1 完了後 |
| 3 | インライン構造提案・差分表示 | Phase 2, diff UI | Phase 2 完了後 |
| 4 | Deep 往復連携 | Phase 1+3 | 将来 |

---

## 関連文書

- Core Principles: [../01_Vision/Core_Principles.md](../01_Vision/Core_Principles.md)
- Band Spec: [Band_Spec.md](Band_Spec.md)
- Data Model: [Data_Model.md](Data_Model.md)
- M3E 仕様設計書 §9: [../M3E仕様設計書.md](../M3E仕様設計書.md)
