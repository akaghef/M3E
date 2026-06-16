# 数学 PDF OCR ツール — 候補列挙と評価

数学書・論文 PDF を M3E のオントロジーノードに流し込むための **OCR / 構造化ツール候補** を網羅的に並べる。数式 (LaTeX) 保持・図版抽出・構造 (Definition/Theorem) 抽出の 3 軸で使えるものを探す前段の整理。

> メタフォルダ: `idea/10_io/` （PDF という外部文書の取り込み = 入出力系なので io 配下。`capture_ingest` が汎用取り込み、こちらは数学特化として並列配置）

## 方針

- 採用判断はしない（商用・OSS を混ぜて並列に並べる）
- 実装は考えない（最終ファイルで最小パイプライン案のみ提示）
- 複数案を並べる（OSS / 商用 / 特化 の 3 系統を横断）
- 「数学書向け」という観点を軸の中心に置く（汎用 OCR は減点）
- 既存の `capture_ingest` / `math_ontology_services` と重複しない範囲で書く

## ファイル構成

- [01_axes.md](01_axes.md) — 評価軸の整理（数式精度・図版・構造・コスト・ライセンス・ホスティング）
- [02_oss_tools.md](02_oss_tools.md) — OSS・ローカル実行系の候補列挙 (Nougat / Marker / MinerU / Docling / pix2text など)
- [03_commercial_tools.md](03_commercial_tools.md) — 商用・クラウド API 系の候補列挙 (Mathpix / LlamaParse / Reducto / Adobe / Google / Azure など)
- [04_specialized_and_helpers.md](04_specialized_and_helpers.md) — 数式特化 OCR と補助ツール (InftyReader / pix2tex / SimpleTex / PyMuPDF / pdf2svg など)
- [05_strategy.md](05_strategy.md) — M3E 取り込みパイプライン戦略 + MVP 最小構成 + 未決質問
- [06_layer_toolmap.md](06_layer_toolmap.md) — **5 層設計 (L0〜L4) × ツールマップ（2026-04 実ウェブ調査）**、推奨ミニマルスタック、横断関心事 (DAG/Provenance/Validate/Diff/HITL)

## 全体俯瞰 / 論点一覧

### 大分類

| 系統 | 代表例 | 強み | 弱み |
|---|---|---|---|
| OSS Layout-aware | Nougat / Marker / MinerU / Docling | 無料・改変可・数式もそこそこ | GPU 要・精度にバラツキ |
| 商用 All-in-one | Mathpix / Reducto / LlamaParse | 数式精度高・運用楽 | 有料・従量課金 |
| 数式特化 | InftyReader / pix2tex / SimpleTex | 数式のみ超高精度 | 文章構造は別途 |
| 補助ライブラリ | PyMuPDF / pdfplumber / pdf2svg / mutool | 解析基盤・図抽出 | 単体では OCR しない |

### 主要論点 (ID 付き)

- **A. 数式表現の選択** — LaTeX / MathML / Unicode plain text / 画像保持
- **B. 実行環境** — ローカル CPU / ローカル GPU / クラウド API / ハイブリッド
- **C. ライセンス許容度** — MIT/Apache OK / AGPL 避ける / 商用有料 OK か
- **D. 出力形式の粒度** — ページ単位 Markdown / ブロック JSON / 文書全体 JSON
- **E. 図版抽出戦略** — ラスタ (PNG) / ベクタ (SVG) / 境界ボックスのみ
- **F. 構造要素の検出** — Definition/Theorem/Proof の自動タグ付けは別レイヤにするか OCR 側でやるか
- **G. 日本語数学書対応** — 和文数学書（岩波・裳華房等）の精度
- **H. 旧版 PDF / スキャン PDF 対応** — OCR 必須 vs テキスト層あり
- **I. コスト許容** — 1 冊 500 ページ × n 冊で $ いくらまでなら OK か
- **J. ハイブリッド運用** — 1 ツールでなく「前処理→数式特化→構造抽出」を分業する価値
- **K. LLM 後処理の位置づけ** — OCR 生出力 → LLM で構造化する二段構え

### 読み順の推奨

1. [01_axes.md](01_axes.md) で判断軸を把握
2. [02_oss_tools.md](02_oss_tools.md) / [03_commercial_tools.md](03_commercial_tools.md) / [04_specialized_and_helpers.md](04_specialized_and_helpers.md) を横断的に眺める
3. [05_strategy.md](05_strategy.md) で M3E 用の最小パイプラインを確認

## 関連ブレスト

- [idea/10_io/capture_ingest/](../capture_ingest/) — 汎用的な取り込み戦略（Web/画像/音声等を含む）。本トピックは PDF 特化版
- [idea/10_io/math_ontology_services/](../math_ontology_services/) — OCR 後のオントロジー化先（Lean/Mizar/OEIS 等との接続）。本トピックは前段
- [idea/10_io/tool_integration/](../tool_integration/) — 外部ツール全般の統合
- [idea/40_data/maintenance_hygiene/](../../40_data/maintenance_hygiene/) — 取り込み後のデータ整理

## キーメッセージ

- **単一ツールで全部は無理**。数式精度・図版抽出・構造検出は別々に最適化されている
- **2026 年時点の本命 OSS は Marker / MinerU / Docling** のどれか（Nougat はやや古い）
- **数式だけなら Mathpix か pix2tex**。書籍全部を商用に流すとコストが重いので **ハイブリッド** が現実解
- **M3E 的には「OCR = Markdown+LaTeX 出力」「図版 = SVG 別チャネル」** の二本立てが素直
- **LLM 後処理で Definition/Theorem を抽出する層** は OCR と分離した方が交換可能性が高い
