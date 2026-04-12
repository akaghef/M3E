# Operations

このディレクトリは、会話や作業の中で発生した判断を、運用に耐える形で一時保存し、正式文書へ昇格させるための場所です。

## 置くもの

- `Decision_Pool.md`
  会話中に出た決定、仮決め、保留、確認待ちを時系列で蓄積する
- `Documentation_Rules.md`
  どこに何を書くか、いつ正式文書へ移すかの運用ルールをまとめる
- `Commit_Message_Rules.md`
  コミットメッセージの形式と `type` の使い分けを定義する
- `Test_and_CICD_Guide.md`
  MVP 期間のテスト戦略と CI/CD 運用の基準を定義する
- `Distribution_Validation_Balanced_Plan.md`
  配布物の主軸を installer 化し、Windows Sandbox で自動検証する運用設計を定義する
- `Command_Panel_Security_Test_Cases.md`
  コマンドパネル実装前に満たすべきセキュリティ受け入れテストを定義する
- `Agent_Roles.md`
  エージェント遂行の役割分担と実行順序を定義する

## この場所の役割

- 会話で決まったことを先に失わず残す
- ADR や Spec に書く前の素材を集める
- 「もう決まったこと」と「まだ仮のこと」を混ぜない
- 更新完了条件 (コミット + daily 追記 + Current_Status 更新) を運用ルールとして維持する

## 正式文書との関係

- 長期的な方針は `01_Vision` と `02_Strategy`
- 仕様の確定は `03_Spec`
- 実装構造の確定は `04_Architecture`
- 重要な設計判断の採択は `09_Decisions`
- その手前の会話ログと決定メモは `06_Operations`

`06_Operations` は最終置き場ではなく、会話から設計へ橋渡しする作業用の保管場所です。

## macOS 移行直後のビルド失敗対処メモ

Windows から macOS へ移した直後に `tsc` や `playwright` が見つからずビルド・起動が失敗した事例を共有します。現在の対象は `beta/` です。

1. **作業ディレクトリを必ず `beta/` にする。** ルート直下で `npm run ...` を叩くと意図しない `package.json` を探しに行き `ENOENT` になります。
2. **環境を移したら最初に `npm install`。** これを忘れると `node_modules/.bin/tsc` や `playwright` がないため `command not found` で止まります。
3. **`npm run build` → `npm start` の順番を守る。** ビルド前に起動すると `dist/node/start_viewer.js` がなく `MODULE_NOT_FOUND` になります。
4. **Playwright を使うなら `npx playwright install chromium` を一度実行。** ブラウザバイナリが無いまま visual test を走らせると失敗します。

通常は `scripts/beta/update-and-launch.sh` か `scripts/beta/launch.sh` を使うのが安全です。
