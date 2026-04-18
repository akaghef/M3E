# mathlib4 Blueprint 概要

元セッション: `1d016d28` ("Store math ontology services in brainstorm"), 2026-04-16

---

**Patrick Massot 作の `leanblueprint` ツール** — 大規模な Lean 形式化プロジェクトを **自然言語数学 ⇄ Lean コード** で並走させる仕組み。

## 本質

論文や書籍サイズの数学を Lean で形式化する際、「informal な LaTeX（人間が読む）」と「formal な Lean 宣言（機械が検証する）」を **同じ DAG 上** で対応付けて管理する。

## 構造

LaTeX で定義・補題・定理を書き、専用マクロで Lean 側とリンク:

| マクロ | 意味 |
|---|---|
| `\begin{theorem}` | 定理ノード本体（人間可読） |
| `\lean{Foo.bar}` | この定理の Lean 宣言名 |
| `\leanok` | Lean 側で証明済みマーク |
| `\uses{thm:a, lem:b}` | 依存する補題の参照（有向エッジ） |
| `\proves{thm:x}` | proof 環境がどの statement を示すか |

## 出力

- **HTML サイト**（LaTeX を MathJax で描画、各ノードに Lean ソースへのリンク）
- **依存 DAG の可視化**（色分け: 🟢証明完了 / 🔵statement形式化済 / 🟡進行中 / ⚪未着手）
- **PDF 版**（論文的に読める）

## 代表プロジェクト

- PFR（Polynomial Freiman–Ruzsa, Tao–Gowers–Green–Manners, 2023）
- Fermat's Last Theorem（Kevin Buzzard 主導、継続中）
- Carleson's theorem
- Sphere eversion
- Liquid Tensor Experiment の姉妹的運用
- Sphere packing（Maryna Viazovska の 8 次元証明）

## M3E との対応

| Blueprint | M3E |
|---|---|
| `\begin{lemma}` | ノード |
| `\uses{}` | リンク（依存エッジ） |
| `\lean{}` | 外部 ID 属性 |
| `\leanok` | status = done |
| DAG 全体 | マップ |
| HTML 出力 | viewer |

Blueprint は「LaTeX を内部表現とした、数学特化の M3E」とほぼ同義。違い:
- Blueprint: **1 プロジェクト = 1 マップ**、LaTeX 駆動、Lean と強結合
- M3E: **個人の思考全般**、独自エディタ、AI 汎用

## 最小接続案

「PFR blueprint を M3E マップとして開く importer」が最小接続で、思想の親和性を即検証できる。

## 参考リンク

- ツール: github.com/PatrickMassot/leanblueprint
- PFR blueprint: teorth.github.io/pfr/blueprint/

*2026-04-17*
