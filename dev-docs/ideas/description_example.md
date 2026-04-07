# M3E 機能紹介 — 開発プロジェクト活用ガイド

M3E（Model, Map, Meaning Engine）は、科学研究者の構造的思考を支援するツールです。ツリー構造のデータモデルを中核に、論文分解・仮説比較・前提整理・設計判断といった知的作業を扱います。本ドキュメントでは、開発プロジェクトを進める上で各機能がどう役立つかの観点で紹介します。

---

## 1. ツリー構造データモデル

すべての情報を `id`・`parentId`・`children`・`text` を持つノードのツリーとして管理します。ノード種別は `text`・`image`・`folder`・`alias` の4つです。

**開発上の利点:**
- コマンドパターンによる全変更の一元管理で、バグ原因の追跡が容易
- 循環参照の禁止や単一スコープ所属など、不変条件が明示されているため実装判断に迷いにくい
- ID体系（`n_<timestamp>_<random>`）が永続的で、外部連携やデバッグ時の参照が安定する

**関連ファイル:** `src/shared/types.ts`, `src/node/rapid_mvp.ts`

---

## 2. スコープ＆エイリアス

`folder` ノードがサブスコープの境界になり、各ノードは直近の祖先フォルダに属します。エイリアスは別ノードへの参照窓で、データ複製なしに複数箇所からの参照を実現します。

**開発上の利点:**
- スコープによる認知負荷の制御は、大規模ツリーでの操作設計の基盤になる
- エイリアスの制約（連鎖禁止、デフォルト読み取り専用、削除時 broken 表示）が明確なので、エッジケース対応を事前に設計できる
- 親変更＝スコープ変更の自動導出により、ドラッグ＆リペアレント実装時にスコープ再計算が不要

**関連ファイル:** `dev-docs/03_Spec/Scope_and_Alias.md`

---

## 3. バンド仕様（思考の帯域）

同一データに対して3段階の密度レベルで操作します。

- **Flash（閃き）** — 高速メモ。割り込みや種を落とさないことが最優先
- **Rapid（日常）** — 日常的な編集と構造化。MVP の主戦場で、キーボード操作に最適化（Tab＝子追加、Enter＝兄弟追加、F2＝編集など）
- **Deep（図解化）** — 高密度な設計ドキュメント。前提マッピングや比較軸の整理に使う

**開発上の利点:**
- バンドごとに許可する操作と UI の複雑度が段階的に定義されているため、機能実装の優先順位が明確
- Rapid バンドの500ノード目標から性能要件を逆算できる
- 将来の Flash / Deep 実装時も、既存のデータモデルを拡張するだけで対応可能

**関連ファイル:** `dev-docs/03_Spec/Band_Spec.md`

---

## 4. クラウド同期

スコープ単位で変更を比較し、三者マージ（base / local / remote）で同期します。単一側の変更は自動適用、同一属性の両側変更はコンフリクト扱いでバックアップ付きの解決ログを残します。

**開発上の利点:**
- スコープ単位のマージ粒度により、同期ロジックのテスト範囲を限定できる
- デバイス優先の衝突解決ポリシーで、実装がシンプルに保たれる
- 同期後のツリーバリデーション必須設計により、壊れたデータが保存されるリスクが低い
- 現時点はファイルベース（`M3E_CLOUD_DIR`）で動作確認でき、本番インフラなしに開発を進められる

**API エンドポイント:** `GET /api/sync/status/:docId`, `POST /api/sync/pull/:docId`, `POST /api/sync/push/:docId`

**関連ファイル:** `src/node/cloud_sync.ts`

---

## 5. AI 基盤とサブエージェント

4層構造（Feature UI → Feature Adapter → AI Infrastructure → Provider Transport）で AI 連携を分離します。AI は提案レイヤーであり、自動コミットは行いません。

**開発上の利点:**
- プロバイダ切り替え（DeepSeek / Ollama / Claude）が環境変数のみで完結し、コード変更不要
- ブラウザ側に API キーを渡さないサーバープロキシ設計で、セキュリティ対応が標準化されている
- `GET /api/ai/status` で機能ごとの有効状態を一括確認でき、UI 側の条件分岐が簡潔に書ける
- AI 障害時もアプリ本体が動作する fail-closed 設計で、AI 依存のリグレッションが起きにくい

**環境変数例:**
```
M3E_AI_ENABLED=1
M3E_AI_PROVIDER=deepseek
M3E_AI_TRANSPORT=openai-compatible
M3E_AI_MODEL=deepseek-chat
```

**関連ファイル:** `src/node/ai_infra.ts`, `src/node/ai_subagent.ts`, `dev-docs/04_Architecture/AI_Infrastructure.md`

---

## 6. Linear ↔ Tree 変換

ツリー構造とテキスト（インデント / Markdown）を相互変換します。インポート時は深度ジャンプ（0 → 3 など）を検証で弾き、変換後にモデルバリデーションを実施します。

**開発上の利点:**
- テキスト入力からのツリー構築で、外部データ取り込みのハードルが下がる
- 可逆性がレベル定義されている（A: 構造・テキスト / B: ノード種別 / C: 不可逆）ので、変換の限界が事前にわかる
- AI と組み合わせれば、自然文からの構造抽出パイプラインを構成できる

**API エンドポイント:** `POST /api/linear-transform/convert`

**関連ファイル:** `src/node/linear_agent.ts`, `dev-docs/03_Spec/Linear_Tree_Conversion.md`

---

## 7. 永続化とインポート/エクスポート

SQLite（`better-sqlite3`）にドキュメント単位で保存します。UPSERT パターンで冪等な書き込みを実現。

**対応フォーマット:**
- **M3E JSON** — 完全往復
- **SQLite** — 内部リストア
- **Freeplane `.mm`** — 部分インポート（構造・テキスト・詳細・ノート・属性・リンクを保持、スタイル/色は失われる）

**開発上の利点:**
- 保存フォーマット v1 が型定義で固定されており、マイグレーション戦略を立てやすい
- Freeplane インポートにより、既存のマインドマップ資産をそのまま検証データに使える
- `M3E_DATA_DIR` 環境変数でデータパスを切り替えられるため、テスト用 DB の分離が容易

**関連ファイル:** `src/node/rapid_mvp.ts`, `dev-docs/03_Spec/Data_Model.md`

---

## 8. ビューア（UI）

SVG ベースのツリー描画、ノード選択、インプレース編集、ドラッグ＆リペアレント、パン＆ズームを単一ファイルで実装しています。

**主要キーボードショートカット:**

| キー | 操作 |
|---|---|
| `Tab` | 子ノード追加→編集開始 |
| `Enter` | 編集モード / 確定→兄弟追加 |
| `F2` | 全選択で編集 |
| `Space` | 折りたたみ/展開 |
| `M` → `P` | ノード移動（マーク→ペースト） |
| `Ctrl+Wheel` | ズーム |

**開発上の利点:**
- 単一ファイル構成のため、初期段階での変更コストが低い
- デモデータセット（`rapid-sample.json`、`airplane-parts-demo.json`、`aircraft.mm`）が揃っており、手動テストがすぐ始められる
- 将来の React シェル化や Canvas 移行の際も、描画ロジックが分離可能な構造になっている

**関連ファイル:** `src/browser/viewer.ts`, `src/browser/viewer.tuning.ts`

---

## 9. コマンド＆Undo/Redo

全変更をコマンドパターンで管理し、200ステップのUndo/Redoスタックを保持します。新規変更でRedoスタックがクリアされます。

**開発上の利点:**
- 任意の変更を巻き戻せるため、実装中の試行錯誤が安全に行える
- コマンドの型が明示されているので、新しい変更操作の追加時にインターフェースが統一される
- 現時点は JSON の全状態クローンで、デルタ方式への最適化を後回しにできるシンプルさ

---

## 10. テスト基盤

- **ユニットテスト** — Node.js 組み込みテストランナー。`npm run test:unit` / `test:unit:watch`
- **ビジュアルリグレッションテスト** — Playwright によるスナップショット比較。`npm run test:visual`

**開発上の利点:**
- バンドラー不要の構成でテスト実行が高速
- ビジュアルテストのベースライン更新が `test:visual:update` 一発で、UI 変更時の回帰確認が効率的
- 特定テストの絞り込み実行（`-g "テスト名"` オプション）で、開発中のフィードバックループが短い

---

## 11. 起動スクリプトと運用

**日常の起動:**
```bash
cd beta && npm install && npm run build && npm start
# → http://localhost:4173 で起動
```

**AI 付き起動（DeepSeek）:**
```powershell
pwsh -File scripts/beta/launch-with-ai.ps1 -BitwardenItem "m3e-deepseek"
```

**ローカル LLM（Ollama + gemma3:4b）:**
```bash
scripts/beta/launch-with-local-gemma.bat
```

**開発上の利点:**
- ワンコマンドで build → launch が完結する構成
- Bitwarden 連携で API キーのハードコードを回避
- `scripts/final/migrate-from-beta.bat` で beta → final の昇格が自動化されている
- `scripts/ops/setrole.ps1` でエージェント用の環境構築も標準化

---

## 12. 三環境アーキテクチャ

| 環境 | ディレクトリ | 状態 | 用途 |
|---|---|---|---|
| **Alpha** | `mvp/` | 凍結 | 参照ベースライン |
| **Beta** | `beta/` | 開発中 | 日常開発と検証 |
| **Final** | `final/` | 安定版 | 配布用リリース |

**開発上の利点:**
- Alpha が凍結されているので、機能の振る舞いを過去バージョンと比較できる
- Beta → Final のマイグレーションスクリプトで、リリース手順のヒューマンエラーを削減
- 各環境が独立した `package.json` を持ち、依存関係の衝突が起きない

---

## 技術スタック一覧

| レイヤー | 技術 |
|---|---|
| 言語 | TypeScript 5.4（tsc でデュアルターゲットビルド） |
| サーバー | Node.js + better-sqlite3 |
| UI | カスタム SVG 描画（React シェル計画中） |
| 数式 | KaTeX |
| AI 連携 | OpenAI 互換 API / Ollama |
| シークレット管理 | Bitwarden CLI |
| テスト | Node.js 組み込みテスト + Playwright |

---

## MVP 完了判定

機能が MVP 完了と見なされる条件:

1. コードが担当ブランチ（`dev-beta-visual` / `dev-beta-data`）にコミットされている
2. 日次ログ（`dev-docs/daily/YYMMDD.md`）が更新されている
3. PR が作成され、ベースブランチ `dev-beta` に向いている
4. マネージャーレビューを経てマージされている
5. 次のサイクルに向けて `origin/dev-beta` にリベースされている
