# 05. M3E 取り込みパイプライン戦略 + MVP + 未決

02〜04 の候補を踏まえて、**M3E で数学書をオントロジー化するための** 取り込みパイプライン戦略を整理する。採用確定ではなく「こう組むと筋が良い」案を並べる。

## S1. パイプラインの段数

### S1-1. 1 段シンプル案

```
PDF → Marker → Markdown+LaTeX → M3E import
```

- **利点**: 最速で動く、依存少ない
- **欠点**: 図版・書誌・構造タグが弱い
- **合う場面**: PoC、雑多な論文読み

### S1-2. 2 段案 (本文 + 構造抽出)

```
PDF → Marker → Markdown → LLM → (章/定理/定義/命題/証明) 構造 JSON → M3E
```

- **利点**: ノード粒度を制御可能、オントロジー質が上がる
- **欠点**: LLM コスト、プロンプト設計必要
- **合う場面**: 教科書を腰を据えて入れる

### S1-3. 3 段案 (本文 + 構造 + 図版別レーン)

```
PDF ─┬→ Marker/MinerU → Markdown+LaTeX ─┐
     ├→ PDFFigures2 → 図 PNG ────────┼→ マージ → LLM 構造化 → M3E
     ├→ pdf2svg / mutool → 図 SVG ───┤
     └→ GROBID → 書誌 TEI ───────────┘
```

- **利点**: 図版・書誌も揃う、M3E の SVG ノード方針と整合 (前の会話)
- **欠点**: ツール数多い、マージ処理が面倒
- **合う場面**: 本気でオントロジー構築

### S1-4. 4 段案 (+ fallback)

S1-3 + **「数式認識失敗領域を pix2tex で再処理」** フォールバック層を追加。
- 利点: 数式精度を押し上げる
- 欠点: 失敗領域の検出ロジックが必要

→ **推し: 段階的に S1-1 → S1-2 → S1-3** に育てる

## S2. 本命ツール選定 (仮推し)

| レイヤ | 第一候補 | 第二候補 | 備考 |
|---|---|---|---|
| 本文+数式 OCR | **Marker** | MinerU | GPL だが個人利用 OK。MinerU は AGPL |
| 数式 fallback | **pix2tex** | SimpleTex | 失敗時のみ |
| 図版 SVG | **mutool convert** | pdf2svg | MuPDF が速い |
| 図版 PNG + caption | **PDFFigures2** | — | 別レーン |
| 書誌 | **GROBID** | — | 別レーン |
| 構造タグ付け | **Claude Opus/Sonnet** | 正規表現 | M3E に LLM 統合あれば内製も可 |
| スキャン和書 | **InftyReader** | PaddleOCR+pix2tex | 該当ある時のみ |
| 商用スポット | **Mathpix** or **LlamaParse** | Reducto, Mistral OCR | 1 冊だけ完璧にしたい時 |

## S3. 出力データモデル（M3E ノードとの対応）

### S3-1. 中間 JSON スキーマ案

```json
{
  "source": {"path": "book.pdf", "hash": "sha256:..."},
  "doc_tree": [
    {
      "type": "chapter",
      "id": "ch1",
      "title": "...",
      "children": [
        {
          "type": "section",
          "id": "ch1.sec2",
          "title": "...",
          "blocks": [
            {"type": "paragraph", "text": "..."},
            {"type": "theorem", "label": "Thm 1.2", "statement_md": "...", "proof_md": "..."},
            {"type": "figure", "caption": "...", "svg_ref": "figs/fig-0003.svg", "png_ref": "figs/fig-0003.png"},
            {"type": "equation", "label": "(1.4)", "latex": "..."}
          ]
        }
      ]
    }
  ],
  "references": [...],   // GROBID 由来
  "concepts": [...]      // LLM 後処理で抽出
}
```

### S3-2. M3E ノードへの写像

- `chapter` / `section` → 子孫関係を持つ通常ノード
- `theorem` / `definition` / `proposition` / `lemma` → `kind` 属性付きノード
- `equation` → `fig_ref` 相当に LaTeX を持たせる
- `figure` → `svg_ref` / `png_ref`（前の SVG ノード方針と直結）
- `references` → `depicts` / `cited_by` エッジ
- `concepts` → 将来の意味グラフ用ノード

### S3-3. エッジ種別

- `contains` (chapter→section→block)
- `proves` (proof → theorem)
- `uses` (theorem → lemma)
- `defines` (definition → concept)
- `illustrated_by` (concept → figure)
- `cites` (paper → paper)

## S4. MVP ロードマップ

### MVP-0 (1 日: まず 1 冊動く)

- Marker をローカル GPU で動かし、**PDF → Markdown+LaTeX** を出力
- 手で Markdown を眺める。精度感を掴む
- M3E に import する仕組みはまだ作らない、手動コピペで数ノード

### MVP-1 (数日: 自動 import)

- 出力 Markdown を M3E の import API に流す薄いスクリプトを書く
- 章・節を木構造ノードとして入れる
- 数式は LaTeX のまま属性に格納、表示は KaTeX

### MVP-2 (1-2 週: 構造抽出)

- LLM で Markdown → Definition/Theorem/Proof タグ付け
- M3E ノードの `kind` 属性を埋める
- 式番号参照を簡易エッジ化

### MVP-3 (1 ヶ月: 図版レーン)

- PDFFigures2 + mutool を併走、図を SVG/PNG で取り出す
- `svg_ref` でノードに添付
- 前会話の「ベクター図ノード」議論と合流

### MVP-4 (継続: 書誌・fallback)

- GROBID を併走させて引用グラフ
- pix2tex fallback を失敗検出とセットで

## S5. 判断の論点 (全体)

過去の論点を集約 + 横断観察:

### 5-1. ツール選定 (02/03/04 からの横断)

- **論点 G1**: OSS 第一候補 = Marker か MinerU か → GPL vs AGPL、精度は実測要
- **論点 G2**: 商用スポット利用は Mathpix か Mistral OCR か → 価格／精度 PoC
- **論点 G3**: 数式 fallback を pix2tex にするか SimpleTex にするか
- **論点 G4**: 図版は SVG / PNG どちらを主にするか（M3E の都合）

### 5-2. 構造化レイヤ

- **論点 G5**: 構造タグ付けを **OCR パイプラインに含める** か、**M3E 側の別スキル** にするか
- **論点 G6**: LLM は Claude 固定か、切り替え可能な抽象層にするか
- **論点 G7**: 概念抽出まで OCR パイプでやるか、後段の「意味グラフ」スキルで分離するか

### 5-3. プライバシー

- **論点 G8**: OCR 結果は policy_privacy に照らして暗号化対象か (数学書は基本 public だが自作ノートを混ぜる場合注意)
- **論点 G9**: 商用 API に送る際の ToS レビューが必要か

### 5-4. スケール

- **論点 G10**: 1 冊あたりの処理時間と再処理性 (ツール更新時に再走らせる)
- **論点 G11**: 差分更新 (書籍の新版、自分のメモの追記) をどう扱うか

## S6. 未決質問（ユーザー確認待ち）

- **Q1**: 取り込みたい書籍の典型例は？（電子組版 PDF が多い / スキャンが多い / arXiv TeX ソース有り多い）
- **Q2**: 和書と洋書の比率は？
- **Q3**: ローカル GPU のスペック（VRAM）は？→ ツール選定に直結
- **Q4**: 有償ツールに月いくらまで払えるか？
- **Q5**: 取り込みの頻度は？（週 1 冊 / 月 10 冊 / 1 年 100 冊）
- **Q6**: オントロジー化の目標粒度は？（章レベル / 定理レベル / 概念レベル）
- **Q7**: 既存 M3E ノードへのマージ戦略（新規書籍は独立ツリー / 既存概念にリンク）

## S7. 横断観察 (このブレストを通して見えたこと)

1. **「数学書 OCR」は単一問題ではなく 3 層問題** = 本文OCR + 数式認識 + 構造抽出。ツールも別々に最適化されているので、選定も 3 軸で行うべき
2. **OSS は 2024-2025 で激変** = Marker/MinerU/Docling が Nougat を置き換えている。2026 時点での最新を前提に
3. **商用は「1 冊完璧」用途** = 大量処理には向かない、OSS をベースにして難しい 1 冊だけ商用に流す
4. **InftyReader は独自カテゴリ** = 他の OSS/商用では代替できない「スキャン数学書」向け
5. **M3E の SVG ノード方針 (前会話) と直結** = 図版レーンを SVG で出す戦略は OCR 選定より後段で独立設計可能
6. **LLM 構造化レイヤが実は本丸** = OCR の差はテキスト粒度で埋めやすい、Definition/Theorem 検出は LLM 一択で勝負がつく
7. **オントロジー化は「書誌グラフ」「概念グラフ」「参照グラフ」の 3 種** = GROBID が書誌、LLM が概念、式番号 parser が参照、とツールも分担

## S8. 次アクションの候補 (ブレスト外)

（このブレスト自体では実装しないが、参考までに）

- **A. 1 冊 PoC**: Marker をインストールして手元の電子組版 PDF を流す
- **B. 精度比較**: 同じ PDF を Marker / MinerU / Mathpix に流して出力差分を見る
- **C. 図版レーン単体 PoC**: PDFFigures2 と mutool を走らせ、M3E に SVG ノードとして入れる実験
- **D. LLM 構造化 PoC**: Markdown をひと章分 Claude に投げて Definition/Theorem JSON を返させる
- **E. InftyReader 検証**: 古書スキャン PDF を持っていれば試用版を試す

採否は決めない。ユーザーが読んで選ぶ用の選択肢。
