# Linear <-> Tree 変換仕様（Draft）

## 目的

M3E の主構造（Tree）と線形表現（Linear）を相互に変換し、
思考入力の速度と構造整合性を両立する。

本仕様は、`Core_Principles.md` の以下と整合する。

- 主構造は親子（Tree）を維持する
- scope は認知境界として扱う
- 実体は単一、見え方を複数にする

## 用語

- Tree: `AppState` の親子構造
- Linear: テキスト中心の一次元表現
- Scope Root: 変換の起点ノード（通常は `currentScopeId`）

## 設計方針

1. 正本は常に Tree とする。
2. Linear は入力・出力インターフェースとして扱う。
3. 変換の既定単位は scope（全体ではなく部分木）とする。
4. 失敗時は fail-closed（曖昧な入力は拒否または明示警告）とする。

## 対象フォーマット

### L1: インデントテキスト（可逆優先）

例:

```text
研究テーマ
  観察
    収穫量低下
  仮説
    温度上昇
```

- 先頭空白数で depth を表現
- 既定インデント幅は 2
- 同 depth の行順は siblings 順に一致させる

### L2: Markdown 見出し/箇条書き（準可逆）

例:

```markdown
# 研究テーマ
## 観察
- 収穫量低下
## 仮説
- 温度上昇
```

- `#` 階層またはリスト階層から depth を推定
- 混在入力は正規化ルールに従う

## 変換ルール

### Tree -> Linear

1. `scopeRootId` を起点に pre-order で走査する。
2. 各ノードを `depth` と `text` に射影する。
3. `nodeType`, `alias`, `broken` などは必要時に注記トークンで出力する。

注記例:

- alias: `[@alias -> <targetId>]`
- broken alias: `[@alias broken]`

### Linear -> Tree

1. 各行を `depth`, `label`, `annotations` に分解する。
2. depth スタックで親子関係を復元する。
3. depth の飛び越し（例: 0 -> 3）は不正入力として reject する。
4. 復元後に model validator を必ず通す。

## 可逆性レベル

- Level A（可逆）
  - `text`, 親子構造, sibling 順序
- Level B（条件付き可逆）
  - `nodeType`, alias 情報（注記トークンを使う場合）
- Level C（非可逆）
  - `details`, `note`, `attributes`, ViewState（collapsed など）

`details` など非可逆情報がある場合、エクスポート時に件数警告を表示する。

## Scope との整合

- 既定変換範囲は `currentScopeId` の部分木。
- 全体変換は明示オプション指定時のみ。
- scope 外ノードは既定で出力しない。

## エラー仕様

- 不正インデント: `InvalidIndentation`
- depth 飛び越し: `InvalidDepthTransition`
- 空ラベル行: `EmptyLabel`
- alias 注記不正: `InvalidAliasAnnotation`

## MVP 実装順

1. L1 Export（Tree -> インデントテキスト）
2. L1 Import（インデントテキスト -> Tree）
3. L2 Export（Tree -> Markdown）
4. L2 Import（Markdown -> Tree）

## コマンド API 案

- `m3e.export("indent")`
- `m3e.import("indent", text)`
- `m3e.export("markdown")`
- `m3e.import("markdown", text)`

## 受け入れ基準

1. L1 で `Tree -> Linear -> Tree` の round-trip が構造同値になる。
2. scope 指定時に scope 外ノードが混入しない。
3. 不正入力が fail-closed で停止し、部分適用しない。

## 関連文書

- `./Data_Model.md`
- `./Import_Export.md`
- `./Scope_and_Alias.md`
- `../01_Vision/Core_Principles.md`