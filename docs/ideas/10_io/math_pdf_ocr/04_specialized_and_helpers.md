# 04. 数式特化 OCR と補助ツール

本体パイプラインの脇で使う「数式だけ」「図抽出だけ」「PDF 低レベル処理だけ」のツール群。単体では完結しないが、組み合わせると総合精度が上がる。

## D. 数式特化 OCR

### D1. pix2tex / LaTeX-OCR (lukas-blecher/LaTeX-OCR)

- **ライセンス**: MIT
- **入力**: 数式の画像 (PNG 切り出し)
- **出力**: LaTeX 文字列
- **強み**: **数式単体で最高精度の OSS**、軽量モデル、CLI & GUI あり
- **弱み**: 画像を数式単位で切り出す前処理が必要、本文は扱えない
- **使い方**: Marker/MinerU が失敗した式だけ再処理、or InftyReader 代替
- **推し度**: ★★★★★ (数式特化 OSS の一番手)

### D2. SimpleTex (RQLuo/SimpleTex)

- **ライセンス**: MIT (OSS 版)、商用 SaaS もあり
- **入力**: 画像
- **出力**: LaTeX
- **強み**: 中国発、pix2tex と並ぶ精度、手書き数式にも対応
- **弱み**: ドキュメントが中国語中心
- **推し度**: ★★★★☆ (pix2tex のオルタ)

### D3. InftyReader (再掲、商用だがここに位置付けし直す)

- **ライセンス**: 商用
- **強み**: スキャン数学書専門、**画像 PDF の本文＋数式を同時に** MathML/LaTeX 化
- **使い所**: 古書・電子化されていない教科書の取り込み
- **ポジション**: 数式特化の老舗、OSS では代替が効かない領域

### D4. im2markup (HarvardNLP/im2markup)

- **ライセンス**: MIT
- **強み**: 研究用途、pix2tex のご先祖
- **弱み**: 古い、精度は pix2tex に劣る
- **推し度**: ★★☆☆☆ (歴史的価値のみ)

### D5. Tex Teller (OleehyO/TexTeller)

- **ライセンス**: MIT
- **入力**: 画像
- **出力**: LaTeX
- **強み**: TrOCR ベースで精度良好、手書きにも対応
- **推し度**: ★★★★☆ (pix2tex のオルタ、データセット違い)

### D6. RapidOCR / MathRapidOCR 系

- **ライセンス**: Apache-2.0
- **強み**: ONNX ランタイム、CPU 高速、軽量
- **弱み**: 数式は別モデル差し替え前提
- **推し度**: ★★★☆☆ (エッジ環境用)

### D7. PP-FormulaNet (PaddleOCR 内)

- PaddleOCR 内の数式認識モジュール。PaddleOCR 本体と一緒に動かす

## E. 図版・ベクター抽出

### E1. pdf2svg (dawbarton/pdf2svg)

- **ライセンス**: GPL-2.0
- **入力**: PDF
- **出力**: ページ単位 SVG
- **強み**: シンプル、ページ丸ごと SVG 化
- **弱み**: 文字がパス化される、フォント情報落ちる
- **使い所**: ページ全体を背景的に埋め込みたい時

### E2. MuPDF / mutool convert

- **ライセンス**: AGPL / 商用
- **強み**: 高速、SVG・PNG・HTML 等多彩な出力、フォント保持オプションあり
- **使い所**: 大量処理、バッチ変換

### E3. dvisvgm

- **ライセンス**: GPL-3.0
- **入力**: DVI / PDF (TeX 経由)
- **出力**: SVG（**数式を MathML or テキストとして保持可能**）
- **強み**: TeX ソースがある場合に数式を構造付きで SVG 化できる
- **弱み**: TeX ソースがない「ただの PDF」にはそのままでは使えない (pdf2dvi 等前処理要)
- **使い所**: 自作 TeX 文書を M3E SVG ノード化する場合に最適
- **推し度**: ★★★★☆ (出典が arXiv LaTeX ソースあり等で光る)

### E4. Inkscape CLI

- **ライセンス**: GPL
- **強み**: PDF → SVG 変換の品質が高い
- **弱み**: 重い、バッチには不向き
- **使い所**: 単ページ手動変換

### E5. PDFFigures 2.0

- 02 で挙げた OSS、図抽出特化。ここにも再掲：図版レーン専用ツールとして位置付け

### E6. pdf2htmlEX (coolwanglu/pdf2htmlEX)

- **ライセンス**: GPL-3.0
- **強み**: PDF を忠実に HTML+CSS 化、見た目維持に強い
- **弱み**: 数式は画像化・CSS 絶対配置でオントロジー抽出には不向き
- **使い所**: ビューワ表示のみ欲しい場合

### E7. pdfplumber / PyMuPDF (fitz) / pypdf

- PDF 低レベル操作。テキスト層の直接抽出、bbox 取得、画像切り出しなど
- **PyMuPDF が最も多機能で速い**
- 本体 OCR の前処理・後処理基盤

## F. 構造化・後処理

### F1. LLM (Claude 4.7 / GPT-5 / Gemini 2.5)

- **役割**: OCR 結果の Markdown を受け取って Definition/Theorem/Proof/Example/Reference にタグ付け
- **メリット**: Ax9 の A9-4/A9-5 を唯一まともに解ける
- **デメリット**: コスト・一貫性・検証要
- **推し度**: ★★★★★ (構造抽出レイヤの本命)

### F2. 正規表現ベース抽出

- `\\begin{theorem}` `定理 1.2` `Def. 3` 等のパターン抽出
- LLM より安く、教科書ごとにルールを書けば高精度
- **推し度**: ★★★★☆ (LLM 前処理として有効)

### F3. spaCy / scispaCy

- NER で概念名詞を抜く
- 数学用語辞書は別途整備が必要
- **推し度**: ★★★☆☆ (補助)

### F4. Grobid (02 に記載、ここでは書誌抽出専用として再掲)

- 参考文献グラフ構築用

### F5. MathML ↔ LaTeX 変換

- `mathconverter` / Pandoc / TeXZilla など
- 内部表現を統一する層

## G. レンダリング・表示側

### G1. KaTeX

- 軽量・速い・ブラウザで LaTeX レンダリング
- M3E SVG レンダラと相性良い

### G2. MathJax

- KaTeX より広範な TeX コマンド対応、重い
- MathML も扱える

### G3. Temml

- TeX → MathML 変換、KaTeX 系

### G4. Mathics

- Mathematica 互換 OSS、数式処理向け (表示ではなく CAS)

## 補助ツールの組み合わせ一例

```
[PDF]
  ├─ Marker or MinerU ──→ Markdown + LaTeX 本文 ──┐
  ├─ PDFFigures2 ──→ 図 PNG + caption ────────┼─→ [中間表現]
  ├─ pdf2svg or mutool ──→ 図 SVG ────────────┤
  ├─ pix2tex (fallback) ──→ 失敗した数式を再抽出 ┤
  └─ GROBID ──→ 参考文献 TEI ────────────────┘
                                                    ↓
                                         LLM (Claude/GPT) で
                                         Definition/Theorem タグ付け
                                                    ↓
                                              M3E ノード化
```

## 論点

- **論点 W1**: **pix2tex を fallback** として組み込むか、最初から全数式を pix2tex に流すか
- **論点 W2**: **dvisvgm を TeX ソース付きケース** で優先採用するか (arXiv は TeX ソース公開あり)
- **論点 W3**: **InftyReader 1 本で完結** させる古書パスを別立てにするか
- **論点 W4**: **図版 SVG 化** は pdf2svg / mutool / dvisvgm のどれを標準にするか
- **論点 W5**: **LLM 構造抽出** は OCR パイプラインに含めるか、M3E 側の別スキルにするか
- **論点 W6**: GROBID の書誌抽出を **オントロジーの引用グラフ** として M3E に取り込むか

## まとめ表: ツールの「役割」別リスト

| 役割 | OSS 筆頭 | 商用筆頭 |
|---|---|---|
| 本文 OCR + 数式 + 構造 | Marker / MinerU | Mathpix / Reducto |
| 数式のみ | pix2tex / SimpleTex | Mathpix Snip |
| 図版 (ラスタ) | PDFFigures2 | — |
| 図版 (ベクタ) | pdf2svg / mutool / dvisvgm | — |
| 書誌 | GROBID | — |
| スキャン和書 | PaddleOCR + pix2tex | InftyReader |
| 構造タグ付け | 正規表現 + LLM | — |
| 画像直 LLM | Zerox | Claude/GPT Vision API |
