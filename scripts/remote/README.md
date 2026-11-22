# Mac mini で Beta workspace を運用する

Mac mini が Beta workspace の record store を保持する。ブラウザーと MCP は Tailscale Serve の HTTPS URL に接続する。各端末のデータ用 clone はこの段階では作らない。MacBook のバックアップは復旧用の JSONL ファイルとして保管する。

## Mac mini の初回導入

`swingby` でログインし、統合・検証済みの `dev-beta` がある `/Users/swingby/dev/M3E` を使う。Node.js 22 以降と npm を用意する。対象 workspace は移行済みで、`swingby` が読み書きできる `store/snapshot.jsonl` があることを確認する。同じ store を開く別のプロセスが停止しており、ポート 4173 が空いている状態で実行する。

以下の `data_dir` は移行済み workspace の絶対パスに、`users` は許可する実際の Tailscale ログイン名のカンマ区切りに置き換える。workspace・map の ID とラベルは Beta ランチャーの既定値を入れている。切替前の Beta で値を上書きしていた場合は、テンプレートの対応する `EnvironmentVariables` に同じ値を入れる。

```sh
(
  set -eu
  checkout=/Users/swingby/dev/M3E
  data_dir='/absolute/path/to/migrated/workspace'
  users='you@example.com'
  log_dir=/Users/swingby/Library/Logs/M3E
  node_bin=$(command -v node)
  test "$(id -un)" = swingby
  test -s "$data_dir/store/snapshot.jsonl"
  cd "$checkout"
  npm --prefix beta ci
  npm --prefix beta run build
  install -d -m 700 "$log_dir"

  job=$(mktemp)
  trap 'unlink "$job"' EXIT
  cp scripts/remote/com.m3e.remote-beta.plist.template "$job"
  plutil -replace ProgramArguments.0 -string "$node_bin" "$job"
  plutil -replace ProgramArguments.1 -string "$checkout/beta/dist/node/start_viewer.js" "$job"
  plutil -replace WorkingDirectory -string "$checkout/beta" "$job"
  plutil -replace EnvironmentVariables.M3E_DATA_DIR -string "$data_dir" "$job"
  plutil -replace EnvironmentVariables.M3E_STORE_DIR -string "$data_dir/store" "$job"
  plutil -replace EnvironmentVariables.M3E_TAILSCALE_USERS -string "$users" "$job"
  plutil -replace StandardOutPath -string "$log_dir/remote-beta.log" "$job"
  plutil -replace StandardErrorPath -string "$log_dir/remote-beta.err.log" "$job"
  plutil -lint "$job"
  install -m 644 "$job" "$HOME/Library/LaunchAgents/com.m3e.remote-beta.plist"
  launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.m3e.remote-beta.plist"
  launchctl print "gui/$(id -u)/com.m3e.remote-beta"
)
```

LaunchAgent は `swingby` のログイン session（Mac mini は常時ログインしている）で `start_viewer.js` を直接起動し、`swingby` は sudo にパスワードが要るため LaunchDaemon にはしない。終了時は launchd が再起動する。サンプル生成とブラウザー起動を無効にし、明示した `M3E_STORE_DIR` を開けなければ起動に失敗する。

`lsof` の出力でリスナーが `127.0.0.1:4173` に限られ、`curl` が 403 を返すことを確認してから Serve を設定する。Serve の出力に表示される MagicDNS 名を MacBook で使う。

```sh
lsof -nP -iTCP:4173 -sTCP:LISTEN
curl -i http://127.0.0.1:4173/
tailscale serve --bg --https=443 http://127.0.0.1:4173
tailscale serve status
```

tailnet の許可済みユーザーで MacBook のブラウザーから `https://<mini>.<tailnet>.ts.net/` を開き、対象 workspace が表示されることを確認する。

## MacBook の MCP

この変更を含む build の `start_mcp.js` を MacBook 上で実行する。以下の `M3E_API_URL` と起動コマンドを MCP クライアントのプロセス設定に登録し、`m3e_get` の `kind: maps` で同じ workspace の map 一覧を確認する。既定の標準入出力（stdio）を使う。`--http` を指定した場合も MCP のリスナーは MacBook の `127.0.0.1` に留まる。

```sh
M3E_API_URL=https://mini.example-tailnet.ts.net \
  /absolute/path/to/node /absolute/path/to/M3E/beta/dist/node/start_mcp.js
```

M3E の Claude Code plugin（`m3e`）を remote に向けるときは、plugin の接続先の設定（`mcp-client.json`）を書き換える。新しい session から remote につながる。

```sh
node scripts/mcp/configure-plugin.mjs --api-url https://<mini>.ts.net
```

## 移設した workspace の印

workspace を remote へ移したら、移す前の端末の workspace データディレクトリに `moved-to-remote.json` を置く。

```json
{"url": "https://<mini>.ts.net"}
```

この印があると、その端末の `start_viewer.js` は起動を拒否し、remote の URL を表示して終了する。移す前の SQLite と store の複製を誤って開き、remote と食い違う編集をすることを防ぐ。

## MacBook のバックアップ

更新済みの checkout と `npm --prefix beta run build:node` の出力を使う。`checkout`、`remote_url`、`backup_dir` を実環境に合わせる。MacBook は許可リストにあるログインで Tailscale に接続する。最初に手動で clone を取得し、成功したら同じコマンドを LaunchAgent に登録する。登録時と以降 3600 秒ごとに実行し、既定で直近 48 世代を保持する。世代数を変える場合は CLI または plist の `ProgramArguments` の末尾に正の整数を指定する。

```sh
(
  set -eu
  checkout="$HOME/dev/M3E"
  remote_url=https://mini.example-tailnet.ts.net
  backup_dir="$HOME/M3E-Remote-Backups"
  log_dir="$HOME/Library/Logs/M3E"
  node_bin=$(command -v node)
  cli="$checkout/beta/dist/node/sync/remote_backup_cli.js"
  cd "$checkout"
  npm --prefix beta run build:node
  install -d -m 700 "$backup_dir" "$log_dir"
  "$node_bin" "$cli" "$remote_url" "$backup_dir"

  mkdir -p "$HOME/Library/LaunchAgents"
  job="$HOME/Library/LaunchAgents/com.m3e.remote-backup.plist"
  cp scripts/remote/com.m3e.remote-backup.plist.template "$job"
  plutil -replace ProgramArguments.0 -string "$node_bin" "$job"
  plutil -replace ProgramArguments.1 -string "$cli" "$job"
  plutil -replace ProgramArguments.2 -string "$remote_url" "$job"
  plutil -replace ProgramArguments.3 -string "$backup_dir" "$job"
  plutil -replace StandardOutPath -string "$log_dir/remote-backup.log" "$job"
  plutil -replace StandardErrorPath -string "$log_dir/remote-backup.err.log" "$job"
  plutil -lint "$job"
  launchctl bootstrap "gui/$(id -u)" "$job"
  launchctl print "gui/$(id -u)/com.m3e.remote-backup"
)
```

バックアップは `/api/sync/clone` が返す `snapshotSeq` 時点の portable snapshot 全体を保存する。journal、commit index、archive は取得対象外。MacBook のスリープや tailnet 未接続が続けば、取得間隔は 1 時間を超える。復旧確認には別の空ディレクトリで `record_store_cli.js --create <dir> --from-snapshot <jsonl>` と `record_store_cli.js --verify <dir>` を使う。

## アクセス境界

Serve を唯一の入口として維持する。Mac mini 上で実行されるプロセスは `127.0.0.1:4173` に直接接続でき、`Tailscale-User-Login` を偽装できる。許可リストは workspace 全体と既存 API に対する入口で、許可するのは `swingby` のファイルにアクセスできる範囲まで信頼するログインに限る。既存のローカルファイル API も許可済み接続から呼び出せる。scope ごとの開示制御と journal の issuer へのログイン反映は対象外。
