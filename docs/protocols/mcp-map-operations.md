# MCPによるMap操作

Basis: DP2 / TOB-E

## 実行境界

M3E MCPは既存BetaサーバーとCoreへのアダプターである。Nodeの生成・コピー・編集・移動・Scope変更・削除とGraphLinkの作成・削除はCoreが検証して保存する。別のMap保存先やViewerは持たない。

既知の対象に対する指定済み操作はMCP Toolsを直接利用する。未決のScope粒度、親子関係とGraphLinkの選択、Layout / Styleなどの判断では、既存の[Map Manager規約](map-manager/README.md)をResources / Promptsから参照する。判断規約の参照と、独立したAgentの起動は同義ではない。

## 参加と操作

`m3e_get` でMap一覧、検索、必要な状態を取得できる。対象が既知なら `m3e_context` の `enter` で参加し、初期状態・revision・Focus・通知開始位置を取得する。Focusは一つ、購読は複数。Resourceの読み取りやメンション選択だけでは参加しない。

`m3e_create` はNode生成・部分木コピー・MF-H一括作成・GraphLink作成、`m3e_update` は内容変更・移動・scopen / unscopen、`m3e_delete` は指定対象の削除（GraphLinkのURIを指定した場合はそのGraphLinkだけ）を担う。GraphLinkは同じMap内の2 Nodeを結ぶ非木の関係で、親子の所有を変えない。既存GraphLinkの内容変更は未対応。`m3e_feedback` は5W1Hの改善記録を保存する。具体的な引数・制約はToolのSchemaを正本とする。

通常の連続操作では、取得済みのContextを利用する。Agentによる全状態のRead–Modify–Write、一時書込スクリプト、Node ID生成、成功後の機械的な再GETは要求しない。Coreの成功結果が、保存された操作の完了根拠となる。表示上の受入や元症状の確認が必要なタスクでは、別途実画面を検証する。

## 変更認識と競合

購読対象の変更をContextごとのイベントとして蓄積する。Codexフックは書込直前に未読イベントを確認する。Scope消滅などで前提が失効した場合は、旧書込を実行せず、新しいFocusと変更内容をAgentへ渡して再判断する。

Scope削除時の退避先は生存する祖先から決定する。退避後に古い意図を新しい場所へ自動適用してはならない。通知欠落や購読断で整合性を保証できない場合は、再同期を要求する。フックの失敗・タイムアウトだけに安全性を依存させず、Coreも書込時点のScopeとrevisionを検証する。

完全な変更差分が返る場合は、その内容を再判断して `expected_revision` で受け入れた変更を指定できる。`requires_read` がある場合は対象を取得し直す。無関係なScopeの変更では通常の作業を停止しない。

## 意味と表示の保持

MF-Hの見出しは親子構造を表す。見出しの深さ・Node数だけを理由にScopeを作らない。部分木コピーでは、対象の子孫・属性・内部参照を保持し、実体IDと内部参照だけを必要に応じて再割当てする。

明示されていない再着色、再配置、追加の分類・Scope・GraphLinkを行わない。既存の意味規約・仕様は保持し、操作仕様と二重管理しない。

Scopeのコピーでは、そのScopeが所有する線形メモ・注釈・Scope定義・Surface設定・内部NodeView参照も保持する。全Mapのルートを部分木としてコピーするときは、元からあるMapルートのScope境界をfolderとして保持する。通常のMF-H見出しをScopeへ変更する処理とは区別する。

## 現在の制限

稼働中のObsidian連携が保存を所有するMapへのMCP書込は `WRITE_UNAVAILABLE` で停止する。SQLiteとVaultをまたぐ原子的保存は未対応であり、既存ViewerのVault保存経路は変更しない。

状態取得はNode、GraphLink、Scope付属データごとにページを持つ。`next_offset`、`next_link_offset`、`next_payload_offset` を各offsetへ渡して続きを取得する。単独の長文・大きな付属値には明示的な切詰め表示があり、その値の全文分割取得は未対応。省略を完全取得と解釈しない。

## クライアント別の確認

CodexではSkillとM3E専用AGENTS.mdがない新規SessionでTool発見、操作、通知、書込拒否を確認する。ChatGPT DesktopではMap / Scopeのメンション検索・選択・Resource参照から実書込まで確認する。どちらかの診断試験をもう一方の実機受入として扱わない。

メンション検索はアプリ専用Toolであり、六つのモデル向けToolと区別する。[OpenAI MCP拡張](https://developers.openai.com/plugins/build/extensions)および[Composer Mentions仕様](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#composer-at-mentions)を利用する。MCPのプロトコル世代によって購読方式が異なるため、導入済みクライアントと互換性のあるSDK・Capabilityを選ぶ。

完了条件と実際の確認結果は[α1タスク](../tasks/mcp-alpha1.md)に記録する。
