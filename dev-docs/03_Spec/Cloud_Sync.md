# Cloud Sync

## 目的

この文書は、Beta におけるクラウド同期の最小戦略を定義する。

- 比較単位を document 全体ではなく `scope` に落とす
- 高度な意味マージやリアルタイム共同編集はまだ扱わない
- 先に「壊れない」「運用できる」ことを優先する

## 前提

- `scope` は認知境界であり、保存・同期の分割単位としても利用する
- 実体ノードの所属 scope は親子構造から導出する
- `alias` は scope をまたぐ参照として残る
- 履歴は当面 linear に進行し、複数 branch 同期は扱わない

## 同期単位

- クラウド同期の比較単位は `scope` とする
- document 全体の push/pull ではなく、scope ごとに差分判定する
- `ViewState` は同期対象に含めない
- `currentScopeId` `scopeHistory` `viewport` などのセッション状態は別管理とする

## 同期対象データ

- scope 内の実体ノード
- scope 内に配置された alias ノード
- scope の親子構造と子順序
- scope ごとの `baseVersion` `savedAt` などの同期メタデータ

以下は document 本体の競合判定から外す。

- 選択状態
- カメラ位置
- drag 中の一時状態
- hover 状態

## 比較モデル

各 scope について、少なくとも次の 3 者を比較する。

- `base`: 最後にローカルとクラウドが一致していた版
- `local`: 端末上の現在版
- `remote`: クラウド上の現在版

比較は scope 単位で開始するが、競合判定は scope 全体一括ではなく node / 操作種別まで落としてよい。

## 変更分類

Beta の同期では変更を次の粗い種類に分類する。

- `create`
- `update`
- `move`
- `delete`
- `reorder`
- `alias-update`

`reparent` は内部的に `move` として扱う。
競合判定は `scopeId` の永続値ではなく、`parentId` と `children` の差分を根拠に行う。

## 自動統合ルール

### 1. 片側のみ変更

- `base -> local` のみ変更: local を採用
- `base -> remote` のみ変更: remote を採用

### 2. 非競合変更

- 両側更新でも変更 node 集合が非重複なら自動統合してよい
- 同一 node でも変更属性が独立していれば自動統合してよい
  - 例: 片側が title 更新、もう片側が color 更新

### 3. move と update

- 同一 node に対する `move` と内容 `update` は両方採用してよい
- ただし適用後に tree 整合性と scope 導出を再検証する

## 競合とみなす条件

以下は自動確定せず「競合」とする。

- 同一 node の同一属性を両側で更新
- `delete` と他操作の衝突
- 同一 node に対する `move` と `move` の衝突
- 同一 sibling 列に対する `reorder` の衝突
- `alias` の target 整合性が崩れる変更
- 自動統合後に cycle や親子不整合が出る変更

## 競合解決ポリシー

### 基本方針

- 競合時は端末優先度で採用版を決める
- 優先度は時刻ではなく、あらかじめ決めた device priority で判定する
- これは完全自動の意味理解ではなく、運用簡素化のための強制規則である

### 端末優先度の適用範囲

- 優先度判定は「競合した scope 内の競合 node / 競合操作」に対して適用する
- scope 全体が競合したからといって、scope 全体を丸ごと上書きしない
- 非競合部分は両側採用を維持する

### 不採用側の扱い

- 不採用側の変更は即時破棄せず conflict backup として退避する
- 少なくとも次を残す
  - `scopeId`
  - `baseVersion`
  - 採用端末
  - 不採用端末
  - 不採用変更の要約
  - 解決時刻

## alias と cross-scope 整合

- `alias` は scope をまたぐため、scope 単体比較だけでは閉じない
- 同期確定後に document 全体で整合性検証を行う
- target delete 時は alias を broken 化して保存可能とする
- target move / rename 後も `targetNodeId` が維持される限り alias は同一 target を参照し続ける
- alias 整合性が自動修復できない場合は競合として残す

## 検証

scope ごとの統合後、最終的に model 検証を必須とする。

- root 到達可能性
- cycle 禁止
- `parentId` / `children` 整合
- alias -> alias 禁止
- broken alias の整合
- scope 導出可能性

検証に失敗した統合結果は確定しない。

## 保存と履歴

- 未同期の意味操作列は保持する
- 同期確定後も直近の競合解決ログは保持する
- 参加端末全体の反映確認が取れた時点で、古い詳細差分は snapshot に畳み込んでよい
- ただし確定 snapshot と最小メタデータは残す

## Beta で採用する割り切り

- 高度な CRDT / OT は採用しない
- 競合時の完全自動意味マージは狙わない
- 危険なケースは端末優先度 + backup + 後段検証で処理する
- まずは document 全体競合より一段安全な `scope` 粒度同期を目標にする

## 将来拡張

- node 単位の意味操作ログ比較
- subtree move の専用競合解決
- alias 競合 UI
- 競合内容のユーザー提示
- scope 単位 lock / lease
- device priority と user priority の分離

## 関連文書

- [./Data_Model.md](./Data_Model.md)
- [./Model_State_And_Schema_V2.md](./Model_State_And_Schema_V2.md)
- [./Scope_and_Alias.md](./Scope_and_Alias.md)
