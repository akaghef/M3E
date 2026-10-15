# M3E MCP α1 検証記録

Basis: DP1 / TOB-V

記録日: 2026-10-15。対象は `mcp-alpha1` worktree で実装し、`dev-beta` へ統合したMCPとプラグイン。

**実装・本流統合・通常Betaへの反映と主要実機検証は完了。総合受入には残件がある。** Codex Desktopでユーザーが選択したScope参照から参加、67ノードのコピー、名称変更、保存・Viewer表示まで成功した。別の新規セッションではScope削除後の実フックによる停止を確認した。同一セッションで両方を連続させる総合シナリオと、既存Viewerの識別子非表示条件は未完了のまま保持する。

完了条件は[元の受入チェックツリー](mcp-alpha1.md)の33項目を維持する。下記の試験数は合格項目数ではない。診断試験、コード実装、実機受入を相互に代用しない。

## 到達状態

| 層 | 状態 | 証拠の範囲 / 残件 |
|---|---|---|
| worktreeの実装 | 主要実装と限定検証が完了 | 既存Core・保存経路を利用するMCP、Resources / Prompts、アプリ用Mention Search、通知・Codexフック。単体・契約69件成功。独立レビュー後の状態であり、固定コミットに対する最終承認ではない |
| 本流統合 | **完了** | 実装 `22a5996`、アイコン `298d2f9` をdev-betaへ反映・push。無関係なprimary作業を保持 |
| 通常稼働への反映 | **完了** | 通常checkoutからbuildし、既存 `scripts/beta/launch.sh` で4173を再起動。配信bundle一致、新規MCP接続でMap一覧・規約Resource取得を確認 |
| Codex実行 | 限定シナリオ成功 | Skill・M3E専用AGENTS.mdなしの新規実行でコピー・名称変更、67ノード作成。実フックで旧前提の書込を停止し、モデルが再判断 |
| GUI受入 | **一部成功・残件あり** | Desktopの実Scope選択→参加→67ノードコピー→名称変更→保存・Viewer表示を確認。ユーザーがM3Eアイコン表示も確認。既存Viewer Inspectorの生識別子表示は残る |

## 成功した検証と証拠

| 検証 | 結果 | 証明できること / 限界 |
|---|---|---|
| 新規単体・契約試験 | **69件成功** | Service 41件、SDKアダプター12件、hooks 16件。原子的な拒否、Scope失効・退避、購読差分、Context分離、通知再送、付属データコピー等。独立レビュアーもService＋hooks 57件、アダプター12件を実行。実GUI受入とは別 |
| 既存回帰試験 | **108件 / 7ファイル成功** | 統合担当の端末出力確認。既存Core・データ整合性・競合・Scope・線形メモ・Vault監視の回帰範囲。全リポジトリの全試験成功という意味ではない。コマンドは下記。個別の永続ログは未保存 |
| CI前のローカル検査 | **3検査成功** | [実行概要](../../tmp/mcp-alpha1-ci-preflight/summary.md)、[実行環境](../../tmp/mcp-alpha1-ci-preflight/runtime.txt)。型検査は6つのtsconfig、依存検査は189 modules / 337 dependencies、重複検査は設定対象22ファイル・4202行で重複ゼロ。ローカルで全suiteは再実行せず、後続のGitHub CIで全suite成功を確認 |
| コピー＋コピー先だけ名称変更 | **独立12項目成功** | [保存状態比較](../../tmp/mcp-alpha1-auto-review/copy-verification.json)。Viewerを開く前に比較し、3ノードの内容・属性・階層・Scope境界、原本と無関係内容の保持を確認。実MCP呼出しでコピー直後の名称変更まで成功。このfixtureには非空のGraphLink、alias、明示的Scope / Surface付属値がないため、それらの実機コピーまで証明しない |
| Cavalier-Smith（1998）の分類図 | **独立46項目成功** | [独立評価](../../tmp/mcp-alpha1-taxonomy/independent-verification.json)。試験モデルへ渡していない一次論文の照合資料で6界・60門・根を含む67ノード、名称・階層・出典、既存内容の保持を確認。一回の成功した一括作成呼出しを記録。データベースの実トランザクション回数を別途追跡したわけではない |
| 他ActorによるScope削除と実フック | **実行経路の独立検証成功** | [実行会話](codex://threads/01a13e2b-85ed-7ff3-bccd-ed7c3f420077)、[独立検証](../../tmp/mcp-alpha1-trusted-hooks/independent-hook-verification.json)。実enter応答とフック結合が一致。外部削除後のモデル書込試行を実PreToolUseが拒否し、モデルへ変更文脈を渡した。ホスト記録に該当MCP呼出しのdispatchがなく、Coreに到達した後の拒否と区別できる。直接のHTTP wire記録は未収集 |
| 退出後の清掃 | **実行経路で確認** | 同じ実フック試験で明示leave成功、フック状態ファイル・試験listener残数ゼロ、サーバーContextは終了済み。SessionEndだけで清掃する経路は単体・診断試験の範囲 |
| Feedback永続化と新規接続 | **診断9項目成功** | [診断記録](../../tmp/mcp-alpha1-feedback/verification.json)。公式SDKの別プロセス接続で5W1Hを追記し、既存記録の保持と新規接続からのMap読取りを確認。手順を指定した診断であり、Skillなしの自律Cold Start受入に数えない |
| 独立コードレビュー | 確認した不具合は修正・回帰確認済み | HTTPエラーの意味保持、購読時の失効取り逃し、URI種別回避、祖先移動後の退避、セッション間Context混入、フック出力・再送、Scope付属値のコピーを確認。並行変更中のレビューであり、本流への統合・稼働反映を証明しない |

新規試験の再実行は `beta/` から、互換Node.js 24環境で `node node_modules/vitest/vitest.mjs run tests/unit/mcp_service.test.ts tests/unit/mcp_server.test.ts tests/unit/mcp_hooks.test.ts`。本検証ではNode.js 24.19.0を利用した。使用したネイティブSQLite依存と異なるNode.jsでは、結果を製品の成否と混同しない。

既存回帰試験はworktreeルートから、同じNode.js環境で実行した。

```sh
node beta/node_modules/vitest/vitest.mjs run \
  beta/tests/unit/rapid_mvp.test.js \
  beta/tests/unit/data_model_integrity.test.js \
  beta/tests/unit/local_doc_conflict_api_integration.test.js \
  beta/tests/unit/scope_param.test.js \
  beta/tests/unit/scope_structure.test.js \
  beta/tests/unit/linear_notes_api.test.js \
  beta/tests/unit/vault_watch_api_integration.test.js
```

## 通常反映とDesktopの追加確認

実装統合コミットの[GitHub Build & Test](https://github.com/akaghef/M3E/actions/runs/38691814531)は、Betaの型検査・依存検査・重複検査・build・全テスト、Final buildを含め成功。Personal Path Check、Installer & Script Lint、Agent Instruction Lintも成功した。Final製品への昇格・デプロイは行っていない。

通常Betaは既存のNode.js 26とネイティブSQLiteを保持した。SQLiteパッケージのengine範囲にはNode.js 26が含まれないため警告は残るが、既存バイナリのハッシュ不変と実DB smokeを確認した。依存追加は `npm install --ignore-scripts`、lockfile不変。互換Node.js 24はMCPアダプターの設定で利用する。

再起動前後の完全一致フラグは **false**。独立差分では、開いていたMapの全状態（18ノード）は完全一致し、差分は保存時刻のみ。一覧28件の集合は不変で、2件の保存時刻と並び順だけ変化した。これはMCP以前から存在する起動時の保存処理と整合する。他27件のMap全文まで不変と断定しない。[読戻し差分](../../tmp/mcp-alpha1-runtime/independent-readback-diff.json)、[配信・起動元](../../tmp/mcp-alpha1-runtime/normal-readback.json)、[新規MCP接続](../../tmp/mcp-alpha1-runtime/normal-plugin-connection.json)。

実ユーザーがCodex Desktopの `@M3E` 候補からTabでScope候補を開き、「生物分類」を選択して送信した。そのResource参照でenter→copy（67ノード）→content updateを実行し、書込間のGETは0回。独立評価21項目で元の76ノードとコピーの内容・階層・属性の保持を確認した。[操作記録](../../tmp/mcp-alpha1-mentions/tool-evidence.json)、[独立保存評価](../../tmp/mcp-alpha1-mentions/independent-verification.json)、[Viewerの目視結果](../../tmp/mcp-alpha1-mentions/viewer.png)。このセッションは開発文脈を持つためCold Startとは呼ばない。67ノードを新規importしたCold Start試験とは別証拠である。

プラグインの配布元・実行元は通常checkoutへ移し、接続先を4173へ設定。既存の3つのフック信頼値と有効状態が不変であることを確認した。アイコンは既存M3Eアプリ画像と完全一致し、ユーザーがコンパスからM3E画像への変更を確認した。[導入検証](../../tmp/mcp-alpha1-runtime/plugin-install-result.json)。

## 失敗・診断の履歴

これらは削除せず保持する。後の成功した試験で、以前の失敗が成功だったことにはしない。

| 記録 | 観測結果 | 受入上の扱い |
|---|---|---|
| [初回コピー検証](../../tmp/mcp-alpha1-validation/copy-verification.json) | コピーは成功したが、名称変更は `approval_policy=never` により、破壊的Toolとして承認判定前に拒否され未完了。自動承認審査の不合格ではない。後の保存状態ではコピー根のScope型とMap付属値にも差分があった | コピー＋名称変更・完全保持の合格には数えない。MCP直後の読戻しではScope型を保持しており、後で変更した実行主体はこの記録だけでは特定できない |
| [Viewerの受動表示診断](../../tmp/mcp-alpha1-validation/passive-viewer-diagnostic.json) | Viewerを開くだけではScope型は変わらず、保存要求も発生しなかった | 初回の差分を「開いただけで壊れる」とは断定しない。診断でありGUI受入ではない。初回試験の実際の操作・書込元特定は未完了 |
| [初期削除試験の起動ログ](../../tmp/mcp-alpha1-recovery/cold-start-stderr.log) | 試験起動設定のプラグイン名が不正で、ロードに失敗 | harness不備。実フックの成否や製品受入の証拠にはしない |
| [フック結合なしの書込停止試験](../../tmp/mcp-alpha1-write-gate/cold-start-events.jsonl) | MCPのcreateはdispatchされ、Coreが `FOCUS_INVALIDATED` で拒否。[結合記録](../../tmp/mcp-alpha1-write-gate/hook-binding-observation.json)は空 | Core側防護の証拠。PreToolUseによる実行前停止の合格には数えない。その後の実フック成功試験とは別に保持 |
| Codex GUIの自動操作 | 統合担当のComputer Use操作がCodexの安全制御で拒否された | GUI経路を完走したとは扱わない。別アプリ・別経路で成功した試験をDesktopのメンション受入へ読み替えない |

## 制約と残件

| 項目 | 現在の境界 / 完了に必要な証拠 |
|---|---|
| Desktopメンション | 実ユーザー選択から書込・保存・Viewer表示まで確認済み。プラグイン候補はTabでMap／Scope候補へ進む。Browserタブ参照・プラグイン参照・Scope Resource参照を区別して確認した |
| 一連の最終受入 | メンション→参加・購読→67ノード保存→継続中の外部Scope削除→停止・再判断を同一の実機経路としては未証明。個別試験の成功は維持し、全体合格へ合算しない |
| Viewerの識別子 | 既存Inspectorの既定表示に生のScope / Node識別子を確認。今回Viewerは変更していないが、ユーザー向けGUIの合格条件から除外しない |
| live vault | live vault連携中のMapへのMCP書込は拒否する。既存のVault保存経路は維持。ファイルシステムとSQLiteを横断する原子保存を保証したという主張はしない |
| 大きな値の取得 | Node、GraphLink、Scope付属データのページ送りは提供。一つの長文・巨大な付属値は明示的に切り詰められ、その値自体の全文分割取得は未対応。切詰め応答を完全取得として扱えない |
| 通知と清掃の実機証拠 | 実フック試験の個別SSEキューは清掃済みで未保存。通知認識はホスト拒否・変更文脈・後続の失効状態で確認。SessionEnd単独の清掃は別の実機確認を要する |
| Feedback再現 | 公式SDKによる永続化・別プロセス接続の診断は成功。元チェックツリーの新規Sessionでの自律再現を、この診断だけで合格としない |
| Skill移行 | 担当確認完了。正規Skillと3つのmirrorを移行し、旧REST資料はarchiveへ保持。関連guardsは成功。旧PJ01 / PJ04は履歴参照として維持。`devM3E` の大文字を含む名前は既存validator違反であり、今回の変更の成功として隠さない |

操作と制約の正規説明は[MCPによるMap操作](../protocols/mcp-map-operations.md)を参照する。

## 統合担当の追記欄

| 更新対象 | 現在値 | 追記する証拠 |
|---|---|---|
| 統合先・確定コミット | dev-beta | 実装22a5996、アイコン298d2f9をpush済み |
| 統合後のbuild・回帰試験 | 成功 | 上記GitHub CIと通常checkout build。ローカル限定177件も成功 |
| 通常サービス再起動 | 完了 | 既存launcher・4173・通常checkout。配信bundleとbuild一致、新規MCP読取成功 |
| Skill移行の最終確認 | 担当確認完了 | 上記の意味保持・guards結果。統合差分の参照を追記 |
| Desktop実選択→書込 | 成功 | Codex Desktop、検証用の生物分類Scope。独立保存評価21項目とViewer表示確認 |
| 最終受入判断 | 未完了 | 元33項目の証拠と残件。未完項目の意味・基準を変更しない |

`tmp/` の証拠リンクは本検証機のローカル原本を指す。新規checkoutだけでは再現されない。証拠を移送・公開する場合は必要分をmanifest付きのパケットにまとめ、機密情報を確認し、この文書のリンク先も更新する。コード試験の端末出力は担当の実行確認を含み、全出力をこのファイルへ複製していない。
