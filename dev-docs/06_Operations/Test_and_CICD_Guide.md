# Test and CI/CD Guide

## 目的

Rapid 期間における品質担保を、次の 2 点で実装運用に落とす。

1. ローカルで再現可能なテスト手順を定義する
2. CI で最低限の壊れ込みを止める

M3E は操作体験とデータ安全性の両立が重要なため、
ユニットテストだけではなく、ビジュアル確認と操作確認を明示的に扱う。

## 適用範囲

- 対象: `beta/` 配下の current Rapid 実装
- 優先対象:
  - データ破壊防止
  - レイアウト整合性
  - ヒットテスト整合性
  - 保存/再読込の再現性

## テストレイヤー

### 1. Model/Command テスト (最優先)

目的:

- add/edit/delete/reparent/collapse の整合性維持
- cycle 防止
- Undo/Redo の破綻防止

代表ケース:

- 連続操作 30 回以上で整合性が崩れない
- root 削除禁止が守られる
- descendant 配下への reparent が拒否される

### 2. Save/Load テスト (最優先)

目的:

- 保存後再読込で同一構造を復元できること
- 破損入力で安全に失敗すること

代表ケース:

- JSON round-trip 同値性
- `.mm` import 最小属性の保持
- 不正フォーマット時に明示エラー

### 3. Layout/HitTest テスト (高優先)

目的:

- 表示上の当たり判定が、レイアウト結果と矛盾しないこと

代表ケース:

- 親より子の X が常に右側にある
- 兄弟の Y 順序が安定している
- 折り畳み時に子孫ノードとエッジが非表示になる
- ノードラベル表示領域が hit rect に内包される
- ズーム・パン後もクリック対象が期待通りである

### 4. Visual Regression テスト (中優先)

目的:

- UI 破綻を早期検知する

最小スナップショット:

- 初期表示
- `Body` 折り畳み
- `Wing` 折り畳み
- 全体俯瞰 (`fit all` 相当)

### 5. Manual Scenario テスト (必須)

目的:

- 自動化しにくい操作感・導線を確認する

最小シナリオ:

1. 起動
2. サンプル読み込み
3. add/edit/delete
4. drag reparent
5. collapse/expand
6. 保存
7. 再読込

判定:

- 初見ユーザーが詰まらずに完走できる
- 操作中にデータ消失が起きない

## ビジュアル品質ゲート (Rapid)

以下は PR マージ前に必須とする。

1. 構文チェック通過
2. Model/SaveLoad の主要テスト通過
3. `aircraft.mm` visual check の手動完了
4. ヒットテスト観点の手動確認完了

ヒットテスト確認項目:

- ノード中央クリックで選択できる
- ラベル近傍クリックで誤選択しない
- 空白クリックで選択が意図せず移動しない
- ドロップ不可対象で reject される

## CI パイプライン方針

Rapid では段階導入とする。

### Stage A (即時導入)

- Trigger: push, pull_request
- Job:
  - Node セットアップ
  - `beta/` の依存インストール (`npm ci`)
  - `npm run test:ci` または最小の unit test

現状:

- `mvp-tests.yml` は legacy cleanup に合わせて削除済み
- Stage A CI は `beta/` 前提で再構成する

### Stage B (次段階)

- headless ブラウザで主要操作スモーク
- スナップショット差分検知
- 失敗時スクリーンショットを artifact 保存

### Stage C (運用安定後)

- PR 必須チェック化
- 失敗時の自動再実行ルール
- nightly で長時間シナリオ確認

## CD 方針 (Rapid)

Rapid では公開デプロイを前提にしない。

- 目的は「配布」ではなく「壊れ込み防止」
- CD は将来の配布導線確定後に導入する
- 現時点では CI の結果を release 判断材料として扱う

## 失敗時の運用

1. CI 失敗時はマージしない
2. 再現手順を `daily` に短く記録する
3. 回避策で通した場合は `Decision_Pool.md` に理由を残す
4. 恒久対応は最小差分で修正し、再発防止ケースを 1 つ追加する

## ドキュメント更新ルール

テスト/CI 運用を変更した場合は次を同時更新する。

1. この文書
2. `00_Home/Current_Status.md`
3. `daily/YYMMDD.md`

更新完了条件は `Documentation_Rules.md` の定義に従う。

## 直近の実行順 (推奨)

1. syntax check を CI 化
2. save/load の回帰テストを追加
3. hit test の半自動テストを追加
4. visual snapshot を 3 ケースだけ導入
5. PR 必須チェック化
