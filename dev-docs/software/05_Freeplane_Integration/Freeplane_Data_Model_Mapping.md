# Freeplane Data Model Mapping

## 目的

この文書は、Freeplane を土台に使うときに M3E の概念をどう写像するかを整理する。

## Freeplane 側の理解

Freeplane は基本的に以下の抽象で捉える。

- `Map`
- `Node tree`
- `Node properties`

つまり、中心は「根付き木 + ノード属性」である。

## M3E との対応

### 対応しやすいもの

- 親子主構造
- 折り畳み
- ノード属性
- ローカル保存
- マップ単位の構造閲覧

### そのままでは不足するもの

- scope を認知境界として扱うこと
- alias を厳密な参照として扱うこと
- command ベースの変更ログ
- 帯域ごとの意味づけ

## 写像の考え方

### Freeplane を正本にしすぎない

- Freeplane の内部概念に M3E 全体を押し込まない
- M3E 固有の制約は外側のモデルで保持する

### 最小写像

- Freeplane node -> M3E の text / folder 候補
- Freeplane の属性やリンク -> M3E の補助メタデータ候補
- Freeplane map root -> ひとつの構造入口

### 外付けで持つべきもの

- scope の意味
- alias の意味
- Flash / Rapid / Deep の帯域意味
- AI 提案と承認フロー

## 実務上の方針

- まずは `.mm` 構造を安定して読み取る
- 構造を自然言語コンテクストへ変換する
- 提案は Freeplane の正本を書き換える前に人間確認を挟む

## 境界線

Freeplane は編集 UI と既存運用基盤として有用だが、M3E の最終的なドメインモデルそのものではない。

## 関連文書

- 現在の方針: [../02_Strategy/Current_Pivot_Freeplane_First.md](../02_Strategy/Current_Pivot_Freeplane_First.md)
- データモデル: [../03_Spec/Data_Model.md](../03_Spec/Data_Model.md)
- ADR: [../09_Decisions/ADR_001_Freeplane_First.md](../09_Decisions/ADR_001_Freeplane_First.md)
