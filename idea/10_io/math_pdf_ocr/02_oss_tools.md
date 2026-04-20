# 02. OSS / ローカル実行系 OCR ツール候補

無料で自分のマシンで動かせる選択肢。数式・構造・図版の 3 軸で評価する。

## B1. Marker (VikParuchuri/marker)

- **リポジトリ**: github.com/VikParuchuri/marker
- **ライセンス**: GPL-3.0 (商用用途は有償ライセンス販売あり → Datalab)
- **出力**: Markdown + JSON、数式は LaTeX、表は Markdown/HTML
- **強み**: 数式・表・コード・画像抽出のバランスが良い、2024〜2025 で急成長、英語以外も OK
- **弱み**: GPU (6〜16GB) 推奨、完全 CPU だと激遅、GPL
- **数式精度**: 高（同時期 OSS で top 層）
- **図版**: ラスタ抽出 + bbox
- **推し度**: ★★★★★ (OSS の第一候補)

## B2. MinerU (opendatalab/MinerU)

- **リポジトリ**: github.com/opendatalab/MinerU
- **ライセンス**: AGPL-3.0
- **出力**: Markdown + JSON（ブロック構造保持）
- **強み**: レイアウト検出が強い、中国 OpenDataLab 製で和文・CJK にも比較的強い、数式は UniMERNet で LaTeX 化
- **弱み**: AGPL が気になる場合あり、モデル重い
- **数式精度**: 高
- **図版**: ラスタ + bbox + 分類（chart/figure/table）
- **推し度**: ★★★★★ (2025 年以降の注目株)

## B3. Nougat (facebookresearch/nougat)

- **リポジトリ**: github.com/facebookresearch/nougat
- **ライセンス**: MIT
- **出力**: Markdown (mmd) + LaTeX インライン
- **強み**: 学術論文 PDF に特化、LaTeX 数式をそのまま吐く、MIT ライセンス
- **弱み**: メンテが鈍い (2024 年以降コミット減)、古い PDF やスキャンに弱い、hallucination 報告あり
- **数式精度**: 中〜高（論文ならば高、教科書だとブレる）
- **図版**: 基本無視（テキストのみ）
- **推し度**: ★★★☆☆ (歴史的に重要、今は Marker/MinerU の方が後発で強い)

## B4. Docling (IBM/docling)

- **リポジトリ**: github.com/DS4SD/docling
- **ライセンス**: MIT
- **出力**: Markdown + JSON + HTML、DocTags 形式
- **強み**: IBM Research 発、表・レイアウト・OCR 統合、ライセンス自由
- **弱み**: 数式対応は比較的新しめ（開発進行中）、数式精度は Marker/MinerU より一歩後ろ
- **数式精度**: 中
- **図版**: 抽出 + 分類
- **推し度**: ★★★★☆ (将来性・ライセンスで有力)

## B5. pix2text (breezedeus/pix2text)

- **リポジトリ**: github.com/breezedeus/pix2text
- **ライセンス**: MIT
- **出力**: Markdown (テキスト＋数式 LaTeX 混在)
- **強み**: 中国語＋英語＋数式混在に強い、CJK 数学書向き、軽量
- **弱み**: 完全 PDF パイプラインというより画像 OCR 寄り、レイアウト検出は他に劣る
- **数式精度**: 中〜高（数式単体）
- **図版**: 基本無視
- **推し度**: ★★★☆☆ (和書の一部ページ再処理に使える)

## B6. GROBID (kermitt2/grobid)

- **リポジトリ**: github.com/kermitt2/grobid
- **ライセンス**: Apache-2.0
- **出力**: TEI XML
- **強み**: 参考文献・著者・メタデータ抽出が神、論文の書誌情報引き抜きに最強
- **弱み**: 本文数式はほぼ無視、書籍より論文向き
- **数式精度**: 低
- **図版**: bbox のみ
- **推し度**: ★★★★☆ (オントロジーの「引用グラフ」構築には必須級。OCR 本体ではなく補助)

## B7. Zerox (getomni-ai/zerox)

- **リポジトリ**: github.com/getomni-ai/zerox
- **ライセンス**: MIT
- **出力**: Markdown（GPT-4o 等 LLM が画像を見て吐く）
- **強み**: LLM が直接ページ画像を読むので構造理解が柔軟、セットアップ簡単
- **弱み**: **LLM API コストがかかる**（OSS は「ラッパー」の意味で、推論は有償）、数式精度は LLM 依存
- **数式精度**: 中〜高（モデル次第）
- **図版**: LLM が説明するが画像抽出は別
- **推し度**: ★★★☆☆ (コスト許容なら楽、ローカル縛りなら外れる)

## B8. PDFFigures 2.0 (allenai/pdffigures2)

- **リポジトリ**: github.com/allenai/pdffigures2
- **ライセンス**: Apache-2.0
- **出力**: 図・表の画像ファイル + JSON metadata
- **強み**: Allen AI 製、**図と表の抽出に特化**、キャプション紐付けあり
- **弱み**: 本文 OCR はしない、Scala 実装
- **数式精度**: — (本文扱わない)
- **図版**: ラスタ抽出 + キャプション
- **推し度**: ★★★★☆ (M3E の SVG ノード方針なら図版抽出として有用、ただしラスタ出力なので別途ベクタ化)

## B9. PaddleOCR (PaddlePaddle/PaddleOCR)

- **リポジトリ**: github.com/PaddlePaddle/PaddleOCR
- **ライセンス**: Apache-2.0
- **出力**: 多様（PP-Structure 含む）
- **強み**: 中国語・日本語・英語全部強い、多機能、PP-FormulaNet で数式対応追加
- **弱み**: 設定が複雑、学習曲線急
- **数式精度**: 中（PP-FormulaNet 次第）
- **図版**: bbox + 抽出
- **推し度**: ★★★★☆ (CJK 強い、和書で効く可能性)

## B10. surya (VikParuchuri/surya)

- **リポジトリ**: github.com/VikParuchuri/surya
- **ライセンス**: GPL-3.0 (商用別)
- **出力**: OCR・レイアウト・読み順・表構造
- **強み**: Marker の内部でも使われている低レベル OCR、単体でも使える、多言語
- **弱み**: 数式は扱わない、単体だと Markdown 化は別途必要
- **数式精度**: —
- **図版**: bbox
- **推し度**: ★★★★☆ (Marker と組み合わせて使う前提)

## B11. OpenParse (Filimoa/open-parse)

- **リポジトリ**: github.com/Filimoa/open-parse
- **ライセンス**: MIT
- **出力**: 構造化ノード (ブロック JSON)
- **強み**: セマンティック分割重視、RAG 用途で設計
- **弱み**: 数式対応は弱め
- **数式精度**: 低〜中
- **図版**: bbox
- **推し度**: ★★☆☆☆ (M3E 直用途には数式弱すぎ)

## B12. Mistral-OCR 相当 (mistralai/docs, OSS ラッパー)

- Mistral OCR API は商用 (03 に回す) だが、同等を狙う OSS ラッパーが複数出現中
- 本命ではないがウォッチ対象

## 比較表 (総合)

| ツール | 数式 | 図版 | 構造 | 日本語 | ライセンス | GPU |
|---|---|---|---|---|---|---|
| Marker | ◎ | ◯ | ◯ | ◯ | GPL | 6-16GB |
| MinerU | ◎ | ◎ | ◎ | ◯ | AGPL | 8-16GB |
| Nougat | ◯〜◎ | × | △ | × | MIT | 7-12GB |
| Docling | △〜◯ | ◎ | ◎ | ◯ | MIT | 任意 |
| pix2text | ◯ | × | △ | ◎ | MIT | 任意 |
| GROBID | × | bbox | ◎ (書誌) | ◯ | Apache | 不要 |
| Zerox | ◯〜◎ | △ | ◯ | ◯ | MIT | API 課金 |
| PDFFigures | — | ◎ | — | — | Apache | 不要 |
| PaddleOCR | ◯ | ◯ | ◯ | ◎ | Apache | 任意 |
| surya | — | bbox | ◯ | ◯ | GPL | 任意 |
| OpenParse | △ | △ | ◯ | ◯ | MIT | 不要 |

## 論点

- **論点 Y1**: 第一候補を **Marker or MinerU** どちらにするか（数式精度は互角、MinerU は AGPL、Marker は GPL）
- **論点 Y2**: 図版抽出を OCR ツール内でやるか **PDFFigures2 / pdf2svg を別レーンで** 走らせるか
- **論点 Y3**: 和書対応で **PaddleOCR or pix2text** をサブツールとして挟むか
- **論点 Y4**: **surya を単独で使う余地** はあるか (Marker に内包されているので通常は不要)
- **論点 Y5**: GROBID を併走させて **書誌情報グラフ** を別途作るか (ontology 的には価値高い)
