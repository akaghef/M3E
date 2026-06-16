# mvp 痕跡の削除計画

mvp/ を「バージョン履歴だけのもの」として扱い、実行可能な参照をすべて消す。
コード内の「rapid-mvp」は機能名・データファイル名として残す。

## 削除対象

### ディレクトリ・ファイル削除

- `mvp/` — 全体削除
- `scripts/alpha/` — 全体削除（launch.bat, update-and-launch.bat）
- `scripts/mvp/` — 全体削除（launch-beta.bat, update-and-launch-beta.bat, README.md）
- `.github/workflows/mvp-tests.yml` — mvp 用 CI
- `docs/02_Strategy/MVP_Definition.md` — 検討: 歴史としてarchiveに移すか削除か

### 文字列修正（mvp への参照を削除/書き換え）

- `scripts/README.md` — scripts 構成説明から alpha/mvp セクション削除
- `AGENTS.md` — mvp 言及を削除
- `docs/00_Home/Home.md` — mvp 言及を削除
- `docs/00_Home/Current_Status.md` — mvp ステータスを「凍結・削除済み」に
- `docs/06_Operations/README.md` — mvp 運用ガイド部分を削除
- `.claude/skills/devM3E/SKILL.md` — mvp 参照を削除
- `.claude/skills/intensive-develop/SKILL.md` — mvp 参照を削除
- `.claude/skills/setrole/SKILL.md` — mvp 参照を削除
- `.claude/skills/launch-final/references/sync_manifest.md` — mvp 言及があれば削除
- `.claude/skills/launch-final/references/final_policy.md` — mvp 言及を削除
- `.claude/agents/data.md` — mvp 参照を削除
- `.claude/agents/team.md` — mvp 参照を削除
- `.claude/agents/visual.md` — mvp 参照を削除
- `.claude/skills/devM3E/agents/whiteboard.md` — mvp 参照を削除
- `final/FINAL_POLICY.md` — mvp 言及を削除
- `.github/copilot-instructions.md` — mvp 言及を削除

### 触らないもの（歴史的言及として残す）

- `docs/daily/260330.md` 〜 `260409.md` — 日次ログ
- `docs/ideas/*.md` — アイデアメモ
- `docs/09_Decisions/ADR_*.md` — 意思決定記録
- `docs/design/*.md` — 設計ドキュメント
- `docs/03_Spec/*.md` — 仕様書
- `docs/04_Architecture/*.md` — アーキテクチャ文書
- `docs/tasks/*.md` — タスクメモ

### 触らないもの（機能名として生きている）

- `beta/src/node/rapid_mvp.ts` — Rapid MVP 機能実装
- `beta/data/rapid-mvp.sqlite` — データファイル
- `beta/tests/unit/rapid_mvp.test.js` — テスト
- `beta/legacy/rapid_mvp.js` — レガシー
- （final/ の対応ファイルも同様）

## 経緯

- mvp/ は凍結済み（memory: project_mvp_frozen.md）
- alpha/ ディレクトリは既に存在しない
- scripts/alpha と scripts/mvp は実質同じもの（どちらも `npm --prefix mvp` を呼ぶ）
- launch-final の exclude 方式移行と同じ会話で決定

## 同時に消すもの（mvp 無関係だが同タイミング）

- `scripts/final/sync-beta-to-final.bat` — migrate と重複、旧 include 方式
- `scripts/final/sync-beta-to-final.sh` — 同上
- `install/assets/icons/m3e-app.svg` — 旧プレースホルダー、新アイコンに差し替え済み

*2026-04-11*
