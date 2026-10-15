# M3E plugin

Basis: DP1 / TOB-E

M3E の既存 Beta サーバーに接続する MCP とセッションフックのパッケージ。
Map データ、保存、Viewer は既存アプリが所有する。Skill は含めない。

## 導入

M3E リポジトリで Beta の依存関係と Node ビルドを用意し、通常 Beta を起動する。
ビルドとアプリサーバーの起動は既存の運用手順に従う。次に使用するリポジトリ、
互換 Node 実行ファイル、通常 Beta の接続先を記録する。

```sh
node scripts/mcp/configure-plugin.mjs --repo-root /path/to/M3E --node /path/to/node --api-url http://127.0.0.1:4173
codex plugin marketplace add /path/to/M3E
codex plugin add m3e@m3e-local
```

`--repo-root` の既定値は設定ヘルパーが属するリポジトリ、`--node` は実行中の Node。
`--api-url` を省略すると通常 Beta の `http://127.0.0.1:4173` を保存する。
一時検証用の `M3E_API_URL` は設定ファイルへ暗黙に保存しない。

インストール後はアプリを再起動し、新規チャットで MCP とフックを確認する。
ホストがフックの信頼確認を要求する場合は、その正規 UI で定義を確認する。
Codex CLIでは `/hooks` からM3Eの定義を確認して信頼する。インストールだけでは
信頼されない。`--ignore-user-config` は保存済みの `hooks.state` も除外するため、
それを使う隔離試験では通常設定を使う試験と区別する。承認情報を保持するときは、
本人が承認済みの同じ定義の設定だけを読み取って引き継ぎ、信頼値を作成しない。
ファイルの存在、CLI の導入成功、フックの単体試験だけではデスクトップの
メンション選択や実際の書込み前拒否を実証したことにはならない。

## 設定と配置

`M3E_HOME/mcp-client.json` に `repoRoot`、`nodeExecutable`、`apiUrl` を保存する。
秘密情報は扱わない。ファイル権限は `0600`。`M3E_HOME` の既定は既存 M3E と同じ。

| OS | M3E_HOME |
| --- | --- |
| macOS | `~/Library/Application Support/M3E` |
| Windows | `%LOCALAPPDATA%\M3E` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/M3E` |

`--m3e-home` は設定先を明示する。別のホームで起動するときは、MCP とフックの
両方に同じ `M3E_HOME` を渡す。`M3E_REPO_ROOT`、`M3E_NODE`、`M3E_API_URL` は
起動時だけの上書き。接続先は認証情報を含まない loopback HTTP(S) URL に限る。
ホストは起動環境変数を絞る場合があるため、シェルの環境変数がMCPへ渡るとは
限らない。通常の導入では設定ヘルパーを使い、接続先を変更した後は新しいMCP接続で
実際のMap一覧を確認する。

起動スクリプトは設定された実体の `beta/package.json` と
`beta/dist/node/start_mcp.js` を確認する。プラグインへアプリのソースをコピーしない。
プラグインがホストのキャッシュへ複製されても、設定済みの実体へ接続する。
設定がない開発時だけ、プラグインと作業ディレクトリの祖先からビルド済みの
リポジトリを探す。候補が複数なら停止し、黙って選ばない。

現在のホスト実装では portable `plugin.json` と legacy manifest のフック読み込みに
差があるため、α1 は `.codex-plugin/plugin.json` と `.mcp.json` を使用する。
MCP はプラグインを基準とする `cwd: "."` と相対パスで起動し、フックは公式の
`${PLUGIN_ROOT}` を使用する。MCP とフックで `PLUGIN_DATA` の対応が異なるため、
共通の接続設定には既存 `M3E_HOME` を使う。

## セッションと変更認識

`PreToolUse` と `PostToolUse` の実際の `session_id`、`tool_use_id`、呼出し入力を
対応付け、成功した enter の `structuredContent.context_id` を保持する。子エージェントが
親の `session_id` を共有しても、各 `context_id` の状態を混ぜない。
生の識別子は実装内部のファイルにのみ保存し、通常の人間向け表示には出さない。

セッションごとの SSE listener が未読イベントをローカルキューへ保存する。
`m3e_create`、`m3e_update`、`m3e_delete` の直前は対象のキューを読み、さらに
サーバーのイベント差分を取得する。Map スナップショットの通常 GET やイベントの
暗黙の既読化はしない。未読変更を最初に見つけた書込みは止め、変更差分をモデルへ
渡す。完全な差分なら、再判断後の書込みで `expected_revision` を明示して確認を
返せるため、再 GET は不要。差分が欠ける場合だけ対象を読み直す。Scope の消滅は
Focus の明示的な再選択、接続確認の失敗は接続の復旧を必要とする。

成功した操作の戻り値から revision と cursor を更新する。遅れて届いた古い応答で
cursor を巻き戻さない。状態更新・listener・期限切れ整理は同じセッションロックを
使い、終了処理と進行中のフックが競合して参加状態を復活させない。`SessionEnd` は全 Context
を leave してローカル状態を消す。SessionEnd が来ない場合に備え、ローカル参加は
最後の関連呼出しから30分で失効する。サーバー側にも独立した Context TTL と
書込み直前の検証が必要。ホストのフック失敗・タイムアウト時は呼出しが継続する
場合があるため、フック単独を安全保証にしない。

診断試験では `M3E_HOOK_STATE_DIR` と `M3E_HOOK_TTL_MS` で一時状態と期限を分離できる。
通常利用では変更しない。

## 公式契約

[プラグイン構造とローカル導入](https://developers.openai.com/plugins/build/plugins)、
[フック](https://learn.chatgpt.com/docs/hooks)、
[ホストの plugin loader](https://github.com/openai/codex/blob/main/codex-rs/core-plugins/src/loader.rs)、
[MCP plugin config](https://github.com/openai/codex/blob/main/codex-rs/codex-mcp/src/plugin_config.rs)。
