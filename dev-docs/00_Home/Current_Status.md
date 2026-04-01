# Current Status

## Update Log (2026-04-02)

- `beta/src/node/start_viewer.ts` / `beta/tests/unit/cloud_sync_api_integration.test.js`
	- sync API の成功レスポンスを統一（`ok/mode/documentId`）
	- 成功系テストでも共通レスポンス契約を検証
- 検証
	- `npm --prefix beta run build`: pass
	- `npm --prefix beta run test:ci`: pass (28 tests)

- `beta/src/node/start_viewer.ts` / `beta/tests/unit/cloud_sync_api_integration.test.js`
	- sync API のエラーレスポンスを統一（`ok/code/error/documentId`）
	- 異常系・競合系テストでレスポンススキーマ検証を追加
- 検証
	- `npm --prefix beta run build`: pass
	- `npm --prefix beta run test:ci`: pass (28 tests)

- `beta/tests/unit/cloud_sync_api_integration.test.js`
	- sync API の異常系 HTTP テストを追加（broken JSON / unsupported format / invalid model / method 405）
- 検証
	- `npm --prefix beta run build`: pass
	- `npm --prefix beta run test:ci`: pass (28 tests)

- `beta/src/node/start_viewer.ts` / `beta/tests/unit/cloud_sync_api_integration.test.js`
	- sync API の HTTP 統合テストを追加（status/push/pull + conflict/force）
	- `createAppServer` を公開し、import 時の自動起動副作用を排除
- 検証
	- `npm --prefix beta run build`: pass
	- `npm --prefix beta run test:ci`: pass (24 tests)

- `beta/src/node/cloud_sync.ts` / `beta/src/node/start_viewer.ts` / `beta/tests/unit/cloud_sync_conflict.test.js`
	- cloud 競合判定ロジックを分離し、unit test を追加して回帰を固定
	- `detectCloudConflict` で push 競合条件を明示化（force/未存在/未指定/一致/不一致）
- 検証
	- `npm --prefix beta run build`: pass
	- `npm --prefix beta run test:ci`: pass (22 tests)

- `beta/src/node/start_viewer.ts` / `beta/src/browser/viewer.ts` / `beta/viewer.html` / `beta/viewer.css`
	- cloud 競合解決フロー（savedAt 比較 + `409 CLOUD_CONFLICT` + 手動解決UI）を追加
	- `Use Local` (force push) / `Use Cloud` (pull) の明示解決導線を実装
- 検証
	- `npm --prefix beta run build`: pass
	- `npm --prefix beta run test:ci`: pass

- `beta/src/node/start_viewer.ts` / `beta/src/browser/viewer.ts`
	- cloud sync の最小導線（status/pull/push）を追加
	- `M3E_CLOUD_SYNC=1` 時のみ有効、既存 local-first 導線は維持
- `beta/README.md`
	- cloud sync（file-mirror mode）の起動設定を追記
- 検証
	- `npm --prefix beta run build`: pass
	- `npm --prefix beta run test:ci`: pass

- `beta/viewer.html` / `beta/viewer.css` / `beta/src/browser/viewer.ts`
	- 重要度ビュー（All / Medium+High / High only）を追加
	- importance 属性ベースで Tree/Linear 両方を同一ルールでフィルタ
- 検証
	- `npm --prefix beta run build`: pass
	- `npm --prefix beta run test:ci`: pass

- `beta/viewer.html` / `beta/viewer.css` / `beta/src/browser/viewer.ts`
	- Tree 右側に Linear パネル（current scope 対象）を実装
	- Tree 選択と Linear 行選択の相互同期を追加
	- Apply で Linear -> Tree 変換を実装（失敗時 fail-closed）
- 検証
	- `npm --prefix beta run build`: pass
	- `npm --prefix beta run test:ci`: pass

- `dev-docs/03_Spec/Linear_Tree_Conversion.md` を追加
	- Linear <-> Tree 変換のビジョン整合（Tree 正本 / scope 基準 / 可逆性レベル）を定義
	- L1（インデント）と L2（Markdown）の段階導入方針を明文化
- `dev-docs/03_Spec/Import_Export.md`
	- 線形変換仕様への参照を追加
- `dev-docs/06_Operations/Decision_Pool.md`
	- 変換方針を working-agreement として登録（2026-04-02-001）
- 記録先: `dev-docs/daily/260402.md`

## Update Log (2026-04-01 / Scope and Alias)

- `scope` / `alias` の Beta 実装前提仕様を整理
- `dev-docs/06_Operations/Decision_Pool.md`
  - `folder` を子 scope の入口とする working-agreement を追加
  - 実体単一所属、`alias -> alias` 禁止、alias 残存中の target delete 拒否を明文化
- `dev-docs/03_Spec/Scope_and_Alias.md`
  - root scope / folder scope / scope 所属規則を追加
  - alias ノードの最低限属性、表示/編集/整合性ルールを追加
  - Beta で固定することと保留事項を分離
- `scope` / `alias` の訂正を反映
  - target delete 時は alias を broken 化し、`元の名前 (deleted)` を既定表示にする
  - alias に write 権限を設定できるようにする
  - 同一 scope 内 alias を許可する
- `beta/` の model 最小実装を追加
  - `TreeNode` に alias 系フィールドを追加
  - `RapidMvpModel` に `addAlias` と broken alias 化を追加
  - save/load validation に alias 整合性検証を追加
- `beta` の unit test を拡張
  - alias 含み round-trip
  - broken alias load
  - `alias -> alias` 禁止
- `Editing_Design.md` に marquee selection 設計を追加
  - 空白ドラッグは marquee selection、wheel/trackpad は `two-finger pan` として用語分離
  - marquee 用 ViewState / HitTest / 制約 / 受け入れ基準を追記
- `beta` viewer に alias 状態表示を追加
  - `read alias` / `write alias` / `broken alias` の見た目を分離
  - alias の inline edit を権限別に分岐
  - target delete 時の broken 化を viewer 側にも反映
- graph-level `Link` の仕様を追記
  - `AppState.links` を relation 集合とする方針を追加
  - node-level `link` 文字列と graph-level `Link` を分離
  - endpoint / delete / layout 非参加の制約を追加
- `beta` の graph-level `Link` model を追加
  - `AppState.links` と `GraphLink` 型を追加
  - save/load validation と delete 時 cleanup を追加
  - unit test に `Link` ケースを追加
- 記録先: `dev-docs/daily/260401.md`

## Update Log (2026-04-01)

- `beta/src/node/rapid_mvp.ts`
	- scope クエリ引数名を `scopeId` から `scopeRootId` に明確化
	- 挙動は「保存された scopeId 参照」ではなく「部分木 root 指定」であることを整理
- `beta/tests/unit/rapid_mvp.test.js`
	- reparent 後に query 結果が構造追従する回帰テストを追加
	- node-level scope カスケード更新不要であることを検証
- 検証
	- `npm --prefix beta run build`: pass
	- `npm --prefix beta run test:ci`: pass

- `beta/src/browser/viewer.globals.d.ts` / `beta/src/browser/viewer.ts`
	- `ViewState` に `currentScopeId` / `scopeHistory` を追加
	- `EnterScopeCommand` / `ExitScopeCommand` を実装（ViewStateのみ変更、Undo/Redo対象外）
	- 画面表示と移動対象を `currentScopeId` の部分木に限定
- `beta/src/node/rapid_mvp.ts`
	- scope 指定クエリ API（`queryNodeIds(scopeId?)` / `queryNodes(scopeId?)`）を追加
- `beta/tests/unit/rapid_mvp.test.js`
	- scope query の unit test を追加
- 検証
	- `npm --prefix beta run build`: pass
	- `npm --prefix beta run test:ci`: pass

- `mvp/src/browser/viewer.tuning.ts` に tuning 項目別コメントを追加
- ノード縦間隔を調整
  - `rootHeight: 120 -> 104`
  - `leafHeight: 94 -> 72`
  - `siblingGap: 20 -> 2`
- `npm --prefix mvp run build:browser` を実行し、`dist/browser/viewer.tuning.js` へ反映
- drag reorder 仕様を `Editing_Design.md` と `Drag_and_Reparent.md` に追記
- `mvp/src/browser/viewer.ts` の drag drop 判定を `drop proposal` ベースへ変更
  - ノード中央帯: `reparent`
  - ノード上下端帯 / sibling 挿入 zone: `reorder`
  - 同一親内 reorder を index 指定移動として適用
  - reorder 挿入ラインを表示
- 記録先: `dev-docs/daily/260401.md`

## Documentation Operation Update (2026-03-30)

- Added `06_Operations/Decision_Pool.md` as the intake point for conversation decisions
- Added `06_Operations/Documentation_Rules.md` for documentation handling rules
- Future conversation decisions should be recorded there before promotion to formal docs

## Update Log (2026-03-31)

- `mvp/` に Playwright ベースの visual regression test 基盤を追加
- 依存関係として `@playwright/test` を追加し、`chromium` ランタイムを導入
- `mvp/` に unit test コマンド（`npm test` / `test:unit:watch` / `test:ci`）を追加
- GitHub Actions に `mvp/**` 対象の自動テスト（push / pull_request）を追加
- 記録先: `dev-docs/daily/260331.md`
- `mvp/src/node/rapid_mvp.ts` に SQLite persistence の最小実装を追加
	- `saveToSqlite` / `loadFromSqlite` を追加
	- `documents` テーブル自動初期化を追加
- `mvp/tests/unit/persistence_db_behavior.test.js` に SQLite 単体テストを追加
	- round-trip / unsupported version / invalid graph
- SQLite 依存を追加
	- `better-sqlite3`
	- `@types/better-sqlite3`
- `mvp/src/node/start_viewer.ts` に SQLite persistence API を追加
	- `GET /api/docs/:id` / `POST /api/docs/:id`
- `mvp/src/browser/viewer.ts` を SQLite persistence API に接続
	- 起動時: SQLite 優先ロード（未保存時は sample fallback）
	- 編集時: autosave（debounce）で SQLite 保存
- ノード編集 UX を欄外入力からノード上インライン編集へ変更
	- `Shift+Enter` / `F2` / ダブルクリックで編集開始
	- 欄外編集 UI を削除
- キーボードナビゲーションを構造ベースへ改善
	- `ArrowLeft`: 親へ移動
	- `ArrowRight`: 子（先頭の可視子）へ移動
	- `ArrowUp` / `ArrowDown`: sibling 優先、なければ同一 depth 近傍へ移動
- viewer の undo/redo キーボード操作を実装
	- `Ctrl+Z`: undo
	- `Ctrl+Shift+Z`, `Ctrl+Y`: redo
	- browser/legacy の両経路で同じ挙動に統一
- Playwright visual test に undo/redo キーボード検証を追加
- legacy JS ファイルを `mvp/legacy/` へ集約
	- `start_viewer.js` / `rapid_mvp.js` / `viewer.js` / `viewer.tuning.js`
	- レガシー起動は `node mvp/legacy/start_viewer.js` に統一
- editor の TypeScript 重複診断回避のため `mvp/src/browser/tsconfig.json` を追加

## Update Log (2026-04-01)

- 開発ブランチ `dev-beta` を作成し、Beta中心運用へ切替開始
- `mvp/` (Alpha) -> `beta/` へ実体を同期し、Beta開発環境を明確化
- `scripts/final/update-and-launch.bat` を追加し、Final 更新+起動を一発化
- `scripts/README.md` / `final/FINAL_POLICY.md` を更新し、運用導線を明文化
- 方針: Alpha は参照用、開発は Beta で継続。Final は Beta 検証済みを migration 経由で反映

## Current Direction

M3E is currently moving from a `Freeplane-first UI` approach to a `Freeplane-informed custom engine` approach.

Freeplane is still important, but mainly as:

- a reference implementation
- a compatible `.mm` import/export target
- a source of useful node concepts and editing patterns

The rendering engine, layout behavior, and editing interaction are being implemented on the M3E side.

## What Is Decided

- UI shell is based on `React + TypeScript`
- Rendering is currently `SVG-first` for MVP speed
- Layout, rendering, and editing behavior should be separated as much as possible
- Freeplane is referenced, but M3E owns its own interaction model
- `.mm` import is part of the MVP path
- MVP test layers and CI stage rollout are documented in Operations
- MVP persistence policy is documented as JSON model + SQLite persistence for Rapid MVP
- `scope` は `folder` を入口とする認知境界として扱い、実体ノードは単一 scope 所属とする
- 他 scope への再利用は `alias` 経由のみとし、`alias -> alias` は禁止する
- alias は同一 scope 内参照も許可し、権限は alias 単位で持てる

## What Is Already Working

- Rapid MVP viewer/editor exists under `mvp/`
- Root-first editing works in the browser
- Node add/edit/delete/collapse works
- Keyboard-first editing works
- Basic zoom and two-finger pan behavior exists
- Key mapping and drag interaction were updated for better operability
- Viewer implementation has been modularized (`viewer.html` + `viewer.css` + `viewer.js` + tuning)
- JSON save/load works
- Minimal `.mm` import now exists
- Demo loaders exist for sample JSON and `aircraft.mm`
- `aircraft.mm` visual check walkthrough now exists for repeatable visual inspection
- Viewer toolbar can tolerate missing optional controls and now supports `Fit all` / `Focus`
- Zoom tuning was adjusted for faster button and wheel response
- Unit tests can run locally with `npm test` and auto-rerun with `npm run test:unit:watch`
- Stage A CI now runs automated unit tests on push and pull_request for `mvp/**`
- SQLite persistence の最小保存/読込 API が model 層で動作（unit test 済み）
- SQLite 保存/読込が viewer の通常導線から利用可能（起動時復元 + autosave）
- ノードテキスト編集がノード上で完結（欄外編集は廃止）
- Beta model で alias access / broken alias / `alias -> alias` 禁止の最小整合性が入った
- Beta viewer で alias 状態ごとの最小表示差分と編集制限が入った
- graph-level `Link` は Beta model/save-load まで入った
- marquee selection の編集設計は文書化済みで、viewer 実装は未着手

## What Is Still Open

- `ViewState` is not fully separated from persisted document state in all code paths
- Minimal `reparent` UI now exists, but still needs refinement
- Imported metadata is preserved but not yet rendered in the UI
- `.mm` support is still MVP-level, not full Freeplane compatibility
- `scope` / `alias` の viewer 導線は最小表示まで実装済みで、作成/遷移 UI は未実装
- alias の作成 UI と `jump to target` は未実装
- graph-level `Link` の viewer overlay 描画と作成 UI は未実装
- marquee selection の viewer 実装と viewport 移動代替操作は未実装
- Some older docs still contain mojibake and need cleanup
- CI pipeline is partially wired (Stage A: unit tests on `mvp/**`), but visual/manual gates are still pending

## 開発環境構成（2026-04-01 更新）

3段階の環境を用意した。詳細は `scripts/README.md` および各環境の POLICY.md 参照。

| 環境 | ディレクトリ | 状態 |
|------|-------------|------|
| Alpha | `mvp/` | 開発停止予定（参照・検証用） |
| Beta | `beta/` | **現行開発環境** |
| Final | `final/` | 安定版リリース環境 |

- Beta には Alpha (mvp/) のソースをコピー済み
- 起動: `scripts/beta/launch.bat` または `scripts/beta/update-and-launch.bat`
- Final への反映: `scripts/final/migrate-from-beta.bat`

## Immediate Next Steps

1. **最優先**: 開発インフラ・テスト環境・CI の整備（Beta 環境で実施）
2. Beta 環境でのビルド・テスト動作確認
3. CI パイプラインを `beta/**` にも対象拡張
4. Demo 品質: ビジュアルポリッシュ・aircraft.mm クリーンレンダリング
5. `scope` / `alias` の最小データ構造と save/load バリデーションを Beta model に落とす
6. broken alias と alias access 権限の最小型を Beta model に追加する
7. viewer で alias 状態ごとの表示差分と操作制限を入れる
8. marquee selection とマウス向け viewport 移動代替操作を Beta viewer に入れる
9. alias 作成導線と `jump to target` 導線を Beta viewer に入れる
10. `AppState.links` と graph-level `Link` validation を Beta model に追加する
11. graph-level `Link` の overlay 描画を Beta viewer に追加する

## Related Documents

- Direction pivot: [Current_Pivot_Freeplane_First.md](/C:/Users/Akaghef/dev/M3E/dev-docs/02_Strategy/Current_Pivot_Freeplane_First.md)
- MVP definition: [MVP_Definition.md](/C:/Users/Akaghef/dev/M3E/dev-docs/02_Strategy/MVP_Definition.md)
- Custom engine ADR: [ADR_003_Freeplane_Informed_Custom_Engine.md](/C:/Users/Akaghef/dev/M3E/dev-docs/09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)
- SQLite MVP ADR: [ADR_004_SQLite_For_Rapid_MVP.md](/C:/Users/Akaghef/dev/M3E/dev-docs/09_Decisions/ADR_004_SQLite_For_Rapid_MVP.md)
- UI basis ADR: [ADR_002_React_UI_Basis.md](/C:/Users/Akaghef/dev/M3E/dev-docs/09_Decisions/ADR_002_React_UI_Basis.md)
- Decision intake: [Decision_Pool.md](/C:/Users/Akaghef/dev/M3E/dev-docs/06_Operations/Decision_Pool.md)
- Test and CI/CD guide: [Test_and_CICD_Guide.md](/C:/Users/Akaghef/dev/M3E/dev-docs/06_Operations/Test_and_CICD_Guide.md)
- Visual design guide: [Visual_Design_Guidelines.md](/C:/Users/Akaghef/dev/M3E/dev-docs/04_Architecture/Visual_Design_Guidelines.md)
- Editing design: [Editing_Design.md](/C:/Users/Akaghef/dev/M3E/dev-docs/04_Architecture/Editing_Design.md)
- Layout algorithm: [Layout_Algorithm.md](/C:/Users/Akaghef/dev/M3E/dev-docs/04_Architecture/Layout_Algorithm.md)
- Ideas folder: [ideas/README.md](/C:/Users/Akaghef/dev/M3E/dev-docs/ideas/README.md)

## Working To-Do (2026-03-30)

### Today Goal

- [ ] Complete MVP visual/UI quality

### UI Core (must)
- [X] ~~*Keep edit flow fast: `Enter` sibling add, `Shift+Enter` edit start, `Tab` child add*~~ [2026-03-30]
- [X] ~~*Keep selection stable after every edit action*~~ [2026-03-30]
- [ ] Improve reparent interaction feedback (target highlight + rejected drop message)
- [ ] Make delete safer (confirm on non-leaf)
- [ ] Ensure collapsed/expanded states are always obvious

### View Experience (must)

- [x] Finalize zoom UX (button + wheel consistency)
- [x] Finalize two-finger pan UX (trackpad / wheel consistency)
- [ ] Add fit-to-content and focus-selected actions
- [ ] Keep viewport stable during frequent edits
- [ ] Remove visual jitter on rapid operations

### Visual Polish (must)

- [ ] Unify spacing and text rhythm across root and child labels
- [ ] Tune edge curvature and color consistency
- [ ] Improve selected-state contrast for readability
- [ ] Handle long node text without layout break
- [ ] Clean up toolbar density for daily use

### Demo Readiness (must)

- [ ] Confirm `aircraft.mm` demo renders cleanly
- [ ] Run `aircraft.mm` visual check and review each checkpoint result
- [ ] Confirm `airplane-parts-demo.json` works with full edit flow
- [ ] Prepare a 2-minute walkthrough script (open -> edit -> reparent -> save)
- [ ] Ensure startup does not block demo flow (`EADDRINUSE` fallback or clear recovery)

### Done Criteria (today)

- [ ] First-time user can complete edit operations without verbal help
- [ ] No obvious visual break during zoom/two-finger pan/edit on demo data
- [ ] UI is judged "demo-ready" by owner review

### Tomorrow Goal (backend/model reform)

- [ ] Separate persisted document state and `ViewState` in all code paths
- [ ] Refine reparent logic and cycle safety checks
- [ ] Standardize model-side validation and error messaging
- [ ] Stabilize save/load boundary and version handling
- [x] ~~SQLite persistence を UI/サーバー導線へ接続（現状は model 層実装のみ）~~ [2026-03-31]

### Day-After-Tomorrow Goal (MVP release & operation start)

- [ ] Package MVP for repeatable startup and demo use
- [ ] Finalize startup recovery for `EADDRINUSE`
- [ ] Prepare operation checklist (run, recover, verify, log)
- [ ] Start MVP operation with the fixed demo scenario
