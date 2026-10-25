# Release Notes v261025（昇格候補・未公開）

日付: 2026-10-25
状態: 昇格候補。main / タグ / Version Registry は未更新。公開には明示承認が必要。

## 候補の出自

- 元の dev-beta commit: `b991c4d`
- 生成方法: 独立した release 作業ツリーで、上記 commit の tracked な `beta/` を `final/` に展開
  - 除外: `Beta_Policy.md`、`prompts/`、`e2e_test_server.js`、`playwright.e2e.config.js`
  - 今回から `public/` を含める（viewer が KaTeX と app アイコンを `public/` から読むため。従来の Final には無かった）
  - `final/data/` の tracked な実行時残骸（初回起動フラグ、conflict backup）を削除
  - `final/FINAL_POLICY.md` は保持
- data schema: v1（SQLite の `maps` テーブル定義と移行処理は `v260419-2` と同一）

## 主な変更（v260419-2 以降）

- Surface: Lane view、Tree / System 切替、fit 対象の切替、layout 方向と間隔の語彙統一
- 編集: 共通の行編集、Lane 名と root 見出しの編集、M Grab による部分木の移動、GraphLink 属性の保存と端点編集
- 描画: WebGL 描画経路（ノードのドラッグ、編集中ノードの HTML 重ね表示、Disperse group 境界）
- 連携: M3E MCP（文脈保持操作）、Claude Code 用 package、Obsidian Vault 往復でのノード同一性保持、リンク先 Markdown のプレビュー
- 運用: Beta / Final の通常起動と更新の分離、公開済みタグだけを Final に導入する更新経路

## 今回の昇格準備で直した欠陥（dev-beta に統合済み）

- Windows で checkout できないファイル名（Windows の絶対パスと改行文字を含む seed SQLite）を `final/` から削除し、同種のファイル名を preflight と CI で拒否する検査を追加
- Final の build が agent アイコン検査（python3 + Pillow と `scripts/ops/`）を必要としていた。リリースディレクトリや Python の無い環境で build が止まるため、Final の build では検査を無効にした
- launcher が書く `final/.node_version` が tracked かつ非 ignore で、checkout からの 2 回目の起動が「Final source is dirty」で止まっていた
- 同梱 seed（`install/assets/seeds/core-seed.sqlite`）の 3 マップ（tutorial の内容を 3 つの id で保持）が保存形式 version 2 で記録されており、現行の読込処理（version 1 のみ受理）では新規利用者の tutorial が開けなかった。version 列だけを 1 に直した（id・保存日時・内容は同一）。seed の全マップが開けることを unit test で検査する
- Windows では `channel-runtime.mjs` が `"npm.cmd" "ci"` の形で npm を呼んでいた。cmd.exe が引用符付き・パス無しのバッチ名に対して `%~dp0` を現在ディレクトリと解釈するため、npm を使う Beta / Final の build がすべて失敗していた。引数だけを引用符で囲む形に直し、`channel-runtime.test.mjs` を Windows CI でも実行するようにした
- Home と Artifacts 画面が `.home-page` / `.artifacts-page` の `font-family: inherit` によりブラウザ既定の明朝体で表示されていた（Mac・Windows の Chrome / Edge 共通）。上書きを外し、body のフォント指定が効くようにした。ブラウザ上のテスト `tests/visual/page_fonts.spec.js` を追加

## 既知の制約

- 既存利用者の workspace に、旧 seed からコピーされた version 2 のマップが残っている場合は開けない。確認した 3 workspace / 50 マップはすべて version 1 で該当なし
- `v260419-2` は Node 26 環境で `npm ci` が失敗する（better-sqlite3 12.8.0 のネイティブ build）。候補は better-sqlite3 12.11.1 で Node 26 でも導入できる
- `final/tests/unit/template_system_builder.test.js` の 5 件は `beta/dist/` の CLI を参照するため、`beta/` を build していない release 作業ツリーでは失敗する（製品動作とは無関係。dev-beta の CI では成功）

## 検証記録

| 項目 | 環境 | 結果 |
|---|---|---|
| `npm ci` / build / typecheck | Mac、Node 26.0.0、release 作業ツリーの `final/` | 成功 |
| unit test | 同上 | 1140 成功 / 5 失敗（上記の `beta/dist` 参照）/ 14 skip |
| dev-beta CI | GitHub Actions（Ubuntu、Node 22。Windows ジョブは起動スクリプトの拒否検査と `channel-runtime.test.mjs`） | `229d16b`・`385765d` 全件成功 |
| 通常起動 `scripts/final/launch.sh` | Mac、一時 `M3E_HOME`、独立 port、`v260419-2` の seed | 起動成功。2 回目の起動も成功 |
| 主要操作 | 同上、tutorial マップ（seed の version を一時データ上で 1 に補正） | ノード追加 → 自動保存（SQLite に反映）→ 再読込 → 再起動後も保持 |
| 新規インストール相当 | Mac、空の `M3E_HOME`、修正後の seed を launcher がコピー | Home から tutorial を開ける。ノード追加 → 再読込で保持。console エラー 0 件 |
| 静的資産 | 同上 | KaTeX と app アイコンを配信（200） |
| 旧版データ → 候補 | `v260419-2` の seed | version 1 のマップは読込可。修正前 seed の version 2 マップは読込不可（今回 seed 側を修正） |
| 候補 → 旧版（復旧方向） | — | 未実施（この Mac に `v260419-2` を動かせる Node 22 が無い） |
| 公開済みタグからの更新経路 | — | 未実施（タグ公開後に実施する工程） |
| Windows checkout | Windows Dell（Windows 11 build 26200、Git 2.53） | 修正前の main は `invalid path 'final/C:\Users\...core-seed.sqlite?'` で checkout 失敗。候補は clean に checkout |
| Windows 通常起動 `scripts\final\launch.bat` | 同上、Node 24.14.0、Pillow 無し（`python` は Store のスタブ）、一時 `M3E_HOME`、独立 port | `npm ci` → build → 起動に成功（62 秒）。bundle hash は Mac の build と一致 |
| Windows 主要操作 | 同上、Mac のブラウザから port 転送で操作 | Home から tutorial を開く → ノード追加 → 再読込で保持。console エラー 0 件。KaTeX と app アイコンを配信（200） |
| Windows 2 回目の起動 | 同上 | 起動成功（build 記録一致で 2 秒）。再起動後もデータ保持、checkout は clean のまま |
| Windows channel-runtime test | 同上 | 修正前 5 件失敗（npm 4 件、bash 経由の POSIX 専用 1 件）→ 修正後 16 件成功・5 件 skip |

## 関連タグ

- 前回: `v260419-2`
- 今回: 未定（承認時に決定）
