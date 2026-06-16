# Codex 指示書: Blueprint Importer

## Vision

M3E は個人研究者の思考を木構造で管理するツール。現在、木の edge に意味情報がなく、スケール限界がある。PJ02 MathOntoBridge は edge に意味を載せるプロトコルの基盤を作るプロジェクトで、**syntax tree**（形式的な依存関係）と **semantic tree**（意味関係）の二本柱で進む。

本タスクは syntax tree 側: **mathlib4 Blueprint の LaTeX ソースを解析し、M3E マップとして取り込む importer** の実装。

## Goal

Blueprint プロジェクトの LaTeX ソース（`.tex` ファイル群）を入力し、定理・補題・定義のノードとその依存関係（`\uses{}`, `\proves{}`）を抽出して、M3E の `AppState` 形式に変換して保存する。

成功条件: **PFR (Polynomial Freiman-Ruzsa) プロジェクトの Blueprint を M3E viewer で開いて DAG として閲覧できる**。

## 重要: データ形式の実態

調査の結果、Blueprint の依存グラフは **JSON ファイルではない**。

- `plastexdepgraph` パッケージが LaTeX を解析し、**Graphviz DOT 文字列を埋め込んだ HTML** を生成する
- ビルド済みの `dep_graph_document.html` には DOT が inline で入っているが、JSON API は存在しない
- **最も確実な入力ソースは LaTeX ソースそのもの**（`.tex` ファイル群）

したがって importer は **LaTeX パーサー**として実装する。

## 入力: LaTeX マクロの仕様

PFR の実データ（`blueprint/src/chapter/*.tex`）から確認した実際のパターン:

```latex
% 定義ノード
\begin{definition}[Entropy]
  \label{entropy-def}
  \lean{ProbabilityTheory.entropy}
  \leanok
  If $X$ is an $S$-valued random variable, the entropy $\bbH[X]$ ...
\end{definition}

% 補題ノード（uses で依存を宣言）
\begin{lemma}[Jensen bound]\label{jensen-bound}
  \uses{entropy-def}
  \lean{ProbabilityTheory.entropy_le_log_card}
  \leanok
  If $X$ is an $S$-valued random variable, then $\bbH[X] \leq \log |S|$.
\end{lemma}

% 証明（proof 内の uses は proof_edges）
\begin{proof}
  \uses{concave}
  \leanok
  This is a direct consequence of ...
\end{proof}

% インラインで全部書くパターンもある
\begin{theorem}[Approx hom PFR]\label{approx-hom-pfr}\lean{approx_hom_pfr}\leanok Let ...
\begin{proof}\uses{goursat, cs-bound, bsg, pfr_aux-improv}\leanok Consider ...
```

### 抽出すべきマクロ

| マクロ | 場所 | 意味 |
|---|---|---|
| `\begin{definition}`, `\begin{lemma}`, `\begin{proposition}`, `\begin{theorem}`, `\begin{corollary}` | 環境開始 | ノードの種類 |
| `\label{xxx}` | 環境内 | ノードの一意識別子（label） |
| `\lean{Foo.bar}` | 環境内 | Lean 4 の宣言名（カンマ区切りで複数あり得る） |
| `\leanok` | 環境内 | Lean で形式化済みフラグ |
| `\uses{label1, label2, ...}` | 環境内 or proof 内 | 依存先の label リスト |
| `\proves{label}` | proof 内 | この証明が示す命題の label |
| `[タイトル]` | `\begin{theorem}[タイトル]` | ノードの表示名 |

### エッジの2種類

1. **statement の `\uses{}`**: 命題 A が命題 B を使う → `relationType: "uses"`
2. **proof の `\uses{}`**: 命題 A の証明が命題 B を使う → `relationType: "uses_in_proof"`（区別が望ましいが、`"uses"` に統一しても可）

## 情報ソース

### M3E 側（このリポジトリ内）

- **型定義**: `beta/src/shared/types.ts` — `TreeNode`, `GraphLink`, `AppState` が核。全フィールドを読んで理解すること
- **マップ保存形式**: `beta/src/node/rapid_mvp.ts` — `SavedMap` の読み書きロジック。JSON ファイルとして `data/maps/` に保存される
- **既存 importer の参考**: `beta/src/node/rapid_mvp.ts` 内の Obsidian Vault import — 外部データを AppState に変換する先行例
- **GraphLink.relationType**: 既に `string?` として存在。Blueprint の uses 依存はここに `"uses"` を入れる

### Blueprint 側（外部）

- **leanblueprint**: https://github.com/PatrickMassot/leanblueprint
- **PFR リポ**: https://github.com/teorth/pfr — `blueprint/src/chapter/*.tex` が入力データ
- **plastexdepgraph**: https://pypi.org/project/plastexdepgraph/ — `Packages/depgraph.py` に DOT 生成ロジック。ノード種別は `definition+lemma+proposition+theorem+corollary`
- **PFR Blueprint サイト**: https://teorth.github.io/pfr/blueprint/

## 対応表（Blueprint → M3E）

| Blueprint 概念 | M3E フィールド | 備考 |
|---|---|---|
| 環境種別（definition/lemma/...） | `TreeNode.attributes.kind` | `"definition"`, `"lemma"`, `"theorem"` 等 |
| `\label{xxx}` | `TreeNode.attributes.blueprint_label` + ID生成に使用 | 名寄せキー |
| 環境タイトル `[タイトル]` | `TreeNode.text` | 例: `"Lemma: Jensen bound"` |
| LaTeX 本文 | `TreeNode.details` | そのまま格納（レンダリングは viewer 側の将来課題） |
| `\lean{Foo.bar}` | `TreeNode.attributes.lean4_decl` | カンマ区切りならそのまま |
| `\leanok` | `TreeNode.attributes.lean_status` = `"ok"` | 未指定なら属性なし |
| `\uses{a, b}` (statement内) | `GraphLink` with `relationType: "uses"` | |
| `\uses{a, b}` (proof内) | `GraphLink` with `relationType: "uses"` | 同じ種別で良い |
| DAG 全体 | `AppState`（1マップ = 1 Blueprint プロジェクト） | |

## 実装方針

### ファイル配置

- `beta/src/node/blueprint_importer.ts` — 新設。LaTeX パーサー + AppState 変換
- API エンドポイントまたは CLI スクリプトとして呼び出し可能にする

### 処理フロー

1. 指定ディレクトリの `.tex` ファイルを全て読み込む
2. 正規表現で `\begin{definition|lemma|...}` 〜 `\end{...}` 環境を抽出
3. 各環境から `\label{}`, `\lean{}`, `\leanok`, `\uses{}`, タイトル `[...]` を抽出
4. `\begin{proof}` 〜 `\end{proof}` の `\uses{}` も抽出（直前の定理/補題に紐付け）
5. 各環境を `TreeNode` に変換
6. `\uses{}` の依存を `GraphLink` に変換
7. `AppState` を組み立てて `SavedMap` として `data/maps/` に保存

### ID 生成

- `TreeNode.id`: `"bp_" + label`（例: `"bp_entropy-def"`, `"bp_jensen-bound"`）
- `GraphLink.id`: `"bplink_" + sourceLabel + "_" + targetLabel + "_" + relationType`

### 木構造

- root ノード 1 つ（プロジェクト名、例: "PFR Blueprint"）
- chapter ごとにフォルダノード（`nodeType: "folder"`）を作り、その下に各定理/補題を配置
- DAG の依存関係は `GraphLink` で表現（親子関係ではなく）

### エッジの方向

- `uses`: A uses B → `sourceNodeId: "bp_A", targetNodeId: "bp_B", direction: "forward"`

## 制約

- **M3E の既存コードを壊さない**。`npm run build` in `beta/` が通ること
- **外部ライブラリの追加は最小限**。LaTeX パースは正規表現で十分（完全な LaTeX パーサーは不要）
- 大規模 Blueprint（PFR: ~100ノード、将来的に数百）でもパフォーマンス問題が出ないこと

## 検証手順

1. PFR リポを clone: `git clone https://github.com/teorth/pfr`
2. importer を実行: `blueprint/src/chapter/*.tex` を入力として指定
3. `data/maps/` に SavedMap JSON が生成されることを確認
4. M3E beta サーバーを起動（`npm run dev` in `beta/`）して viewer で開く
5. ノード（定理/補題/定義）と依存線（uses）が DAG として表示されることを確認

## 参考: 期待する出力の AppState 例

PFR の entropy.tex 冒頭部分から生成される想定:

```json
{
  "rootId": "bp_root",
  "nodes": {
    "bp_root": {
      "id": "bp_root",
      "parentId": null,
      "children": ["bp_ch_entropy"],
      "text": "PFR Blueprint",
      "collapsed": false,
      "details": "",
      "note": "",
      "attributes": { "source": "leanblueprint", "project": "PFR" },
      "link": ""
    },
    "bp_ch_entropy": {
      "id": "bp_ch_entropy",
      "parentId": "bp_root",
      "children": ["bp_entropy-def", "bp_relabeled-entropy", "bp_jensen-bound"],
      "nodeType": "folder",
      "text": "Shannon entropy inequalities",
      "collapsed": false,
      "details": "",
      "note": "",
      "attributes": {},
      "link": ""
    },
    "bp_entropy-def": {
      "id": "bp_entropy-def",
      "parentId": "bp_ch_entropy",
      "children": [],
      "text": "Definition: Entropy",
      "collapsed": false,
      "details": "If $X$ is an $S$-valued random variable, the entropy $\\bbH[X]$ ...",
      "note": "",
      "attributes": {
        "blueprint_label": "entropy-def",
        "kind": "definition",
        "lean4_decl": "ProbabilityTheory.entropy",
        "lean_status": "ok"
      },
      "link": ""
    },
    "bp_relabeled-entropy": {
      "id": "bp_relabeled-entropy",
      "parentId": "bp_ch_entropy",
      "children": [],
      "text": "Lemma: Entropy and relabeling",
      "collapsed": false,
      "details": "If $X: \\Omega \\to S$ and $Y: \\Omega \\to T$ are random variables ...",
      "note": "",
      "attributes": {
        "blueprint_label": "relabeled-entropy",
        "kind": "lemma",
        "lean4_decl": "ProbabilityTheory.entropy_comp_of_injective, ProbabilityTheory.entropy_of_comp_eq_of_comp",
        "lean_status": "ok"
      },
      "link": ""
    },
    "bp_jensen-bound": {
      "id": "bp_jensen-bound",
      "parentId": "bp_ch_entropy",
      "children": [],
      "text": "Lemma: Jensen bound",
      "collapsed": false,
      "details": "If $X$ is an $S$-valued random variable, then $\\bbH[X] \\leq \\log |S|$.",
      "note": "",
      "attributes": {
        "blueprint_label": "jensen-bound",
        "kind": "lemma",
        "lean4_decl": "ProbabilityTheory.entropy_le_log_card, ProbabilityTheory.entropy_le_log_card_of_mem",
        "lean_status": "ok"
      },
      "link": ""
    }
  },
  "links": {
    "bplink_relabeled-entropy_entropy-def_uses": {
      "id": "bplink_relabeled-entropy_entropy-def_uses",
      "sourceNodeId": "bp_relabeled-entropy",
      "targetNodeId": "bp_entropy-def",
      "relationType": "uses",
      "direction": "forward"
    },
    "bplink_jensen-bound_entropy-def_uses": {
      "id": "bplink_jensen-bound_entropy-def_uses",
      "sourceNodeId": "bp_jensen-bound",
      "targetNodeId": "bp_entropy-def",
      "relationType": "uses",
      "direction": "forward"
    }
  }
}
```
