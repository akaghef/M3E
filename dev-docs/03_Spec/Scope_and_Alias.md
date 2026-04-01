# Scope and Alias

## 目的

この文書は、M3E の `scope` と `alias` を Beta 実装で扱える粒度まで定義する。

- `scope` は認知境界と編集境界を与える
- `alias` は実体複製なしで他 scope のノードを見せる
- Freeplane 由来の tree だけでは表せない M3E 固有意味をここで固定する

## なぜ scope が必要か

ファイルやタブの開閉だけでは、思考対象の境界をうまく制御できない。  
M3E は storage boundary ではなく cognition boundary を扱うために scope を導入する。

## Scope の定義

scope は「どこまでを 1 つの局所世界として見るか」を定める単位である。

- `folder` は子 scope の入口ノードである
- document root の直下には暗黙の root scope がある
- 各実体ノードはちょうど 1 つの scope に属する

scope は以下を制御する。

- 何が見えるか
- どこまで編集できるか
- どの構造を同時に考えるか

## Scope の決定規則

### 1. root scope

- document 全体に 1 つだけ存在する暗黙 scope
- どの `folder` 配下にも入っていない実体ノードは root scope 所属とみなす

### 2. folder scope

- `folder` ノード 1 つにつき子 scope を 1 つ作る
- `folder` ノード自身は親 scope に属する
- `folder` の直下以下の子孫実体は、その `folder` scope に属する
- ただし子孫に別の `folder` が現れた時点で、その下はさらに内側の scope へ切り替わる

### 3. 所属の一意性

- 実体ノードは複数 scope に同時所属しない
- ある scope から別 scope へ見せたいときは移動ではなく `alias` を置く

## Scope の原則

### 閉包性

- 原則として scope 内で思考を完結させる
- 外部の情報は既定で露出しない

### 局所性

- 日常操作は現在 scope に最適化する
- 全体俯瞰は要約された形で扱う

### 往復可能性

- folder を開くとその folder world に入る
- 戻る操作で迷子にならないことを重視する

## Scope の可視・編集ルール

### 通常表示

- 現在 scope の実体ノードを主表示対象にする
- 親 scope の情報は breadcrumb や入口ノードなど要約導線としてのみ見せる
- 他 scope の実体は常時フル表示しない

### 編集

- 直接編集できるのは現在 scope 内の実体ノードと、その scope に置かれた alias ノードに限る
- scope 外の実体内容を、alias 経由の通常編集で直接書き換えない
- target 実体を編集したい場合は、その実体の属する scope へ移動して行う

### 移動

- 実体ノードを別 scope へ move した場合、所属 scope は移動先に合わせて更新する
- subtree move では、配下ノードも同じ規則で再計算する
- ただし配下に `folder` がある場合、その `folder` より下は独立 scope として維持する

## Alias の役割

alias は、他 scope の実体を複製せずに参照するための窓である。

## Alias の原則

- alias は参照専用である
- 実体の正本は 1 箇所だけに置く
- 他 scope へ見せたいときだけ alias を置く
- alias から alias は辿らない

## Alias ノード仕様

### 最低限の属性

- `id`
- `type: "alias"`
- `parentId`
- `children: []`
- `scopeId`
- `targetNodeId`
- `aliasLabel?`
- `createdAt`
- `updatedAt`

### target 制約

- `targetNodeId` は実体ノードのみを指せる
- target は `text` `image` `folder` のいずれか
- `alias -> alias` は禁止する
- target が同一 scope 内にある alias は原則作らない

### 表示ルール

- `aliasLabel` があればそれを優先表示する
- `aliasLabel` がなければ target の現在ラベルを表示する
- alias は通常ノードと見分けがつく視覚表現を必須とする
- target scope 名や外部参照であることが分かる補助表示を持てるようにする

### 操作ルール

- alias の rename は既定で `aliasLabel` の編集として扱う
- target 実体の rename は target 側 scope で行う
- alias の delete は alias 自体のみを削除し、target 実体には影響しない
- alias 選択時は `jump to target` を明示操作として提供できる
- target が `folder` の場合、alias から target scope へ遷移できる

### 禁止事項

- alias に子を持たせない
- alias を主構造の所有権ノードとして扱わない
- alias を target の保存先 scope 変更手段として使わない

## Scope と Alias の組み合わせで解く問題

- 見えすぎることで集中が崩れる
- 同じノードを複製して整合性が壊れる
- 全体と局所の往復が煩雑になる
- 参照元ごとに文脈だけ変えつつ、正本は一意に保つ

## 整合性ルール

### 1. delete

- target 実体に alias 参照が残っている間は、既定では target delete を拒否する
- 将来 `delete with alias cleanup` を入れる余地はあるが、Beta では保守的に拒否を標準とする

### 2. move / reparent

- target 実体を別親へ移動しても `targetNodeId` は不変
- その結果 scope 所属が変わっても alias は同じ target を参照し続ける
- alias 自身の move は設置 scope の変更として扱うが、target の所属は変えない

### 3. rename

- target rename は `aliasLabel` 未設定の alias 表示へ即時反映される
- `aliasLabel` 付き alias は target rename の影響を受けない

### 4. invalid target

- save/load 時に `targetNodeId` 不在を検出した場合は document を invalid とみなす
- UI では broken alias として表示できても、保存時には明示エラーとする

## Beta 実装で先に固定すること

- scope 所属は nearest ancestor folder から決定する
- alias は leaf ノードとして扱う
- alias 編集は target 直接編集と分離する
- alias 残存中の target delete は拒否する
- Freeplane `.mm` には `scope` / `alias` の完全往復をまだ要求しない

## Beta 実装でまだ保留にすること

- 1 つの実体を複数 alias で一覧するときの集約 UI
- alias の権限差分や read-only 解除
- scope 横断検索時の表示優先順位
- `.mm` export 時の alias 表現形式
- alias への annotation を `aliasLabel` 以外にどこまで持たせるか

## UI/UX 上の含意

- 現在 scope 外の情報は常時表示しない
- 外部参照は alias や明示的導線でのみ見せる
- rename / move / delete 時は alias 表示との整合を保つ
- folder は「子を持つノード」であるだけでなく「scope 入口」であることが分かる必要がある
- alias は通常ノードと誤認されない見た目と操作ラベルを持つ必要がある

## 実装メモ

- model では `scopeId` を永続化するか、親子構造から毎回再計算するかを後続で決める
- viewer は `currentScopeId` を持ち、表示フィルタと編集制約の根拠に使う
- save/load 層では `alias -> alias` と broken alias を禁止するバリデーションが必要
- command 層では `createAlias` `moveNodeAcrossScope` `deleteNodeWithAliasCheck` を明示した方がよい

## 関連文書

- 原則: [../01_Vision/Core_Principles.md](../01_Vision/Core_Principles.md)
- 実体モデル: [./Data_Model.md](./Data_Model.md)
- Freeplane 境界: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
