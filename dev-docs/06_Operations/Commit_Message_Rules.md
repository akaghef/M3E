# Commit Message Rules

## 目的

コミット履歴を見たときに、変更の種類と意図を短時間で判別できる状態を保つ。

## 基本形式

コミットメッセージは次の形式を基本とする。

`<type>: <imperative summary>`

例:

- `fix: correct textbox width for Chinese characters`
- `feat: add cloud sync conflict banner`
- `refactor: simplify viewer layout metrics`
- `test: add CJK text sizing regression check`
- `docs: document beta integration flow`
- `chore: update beta launch script`

## `summary` の書き方

- 命令形または現在形で簡潔に書く
- 何を変えたかを先に書く
- 可能なら対象を具体化する
- 句点は付けない
- 曖昧な要約 (`update files`, `misc fixes`) は避ける

## 使用する `type`

- `fix`
  バグ修正、回帰修正、意図しない挙動の是正
- `feat`
  新機能、ユーザー価値のある機能追加
- `refactor`
  挙動を変えない構造整理、責務分離、内部改善
- `test`
  テスト追加、テスト改善、再現ケースの固定
- `docs`
  文書追加、仕様整理、運用ルール更新
- `chore`
  雑務的変更、ビルド補助、スクリプトや設定の軽微更新

## 運用メモ

- PR タイトルも同じ形式を推奨する
- 1 コミット 1 意図を基本とする
- 変更種類が複数ある場合は、そのコミットの主目的に合わせて `type` を選ぶ
- 迷った場合は「ユーザーに見える変化なら `fix` / `feat`、見えない整理なら `refactor`」で判断する

## このリポジトリでの位置づけ

`AGENTS.md` の imperative message ルールを、実運用しやすい形式に具体化した補助規約とする。
