# Mac mini で Beta workspace を運用する

Mac mini が Beta workspace の record store を保持する。ブラウザーと MCP は Tailscale Serve の HTTPS URL に接続する。各端末のデータ用 clone はこの段階では作らない。MacBook のバックアップは復旧用の JSONL ファイルとして保管する。

## 各端末の Neo4j

record store の Neo4j は各端末で 1 つ、loopback（127.0.0.1:7687）だけで待ち受け、ログイン時に起動して落ちれば再起動する。利用者は `neo4j`、パスワードは端末ごとに生成し、M3E home の `secrets/neo4j-password`（macOS は 0600、Windows は本人だけの ACL）に置く。Beta サーバーには `M3E_NEO4J_BOLT`・`M3E_NEO4J_USER`・`M3E_NEO4J_PASSWORD_FILE` を渡し、パスワードの値そのものは環境変数にも launcher にも書かない。`scripts/beta/launch.sh`・`launch.bat` は、この file があればその path を渡す。

| 端末 | 導入 | 常駐 | 設定 file |
|---|---|---|---|
| Mac mini | Homebrew `neo4j`（`/opt/homebrew` は swingby の所有で sudo 不要） | LaunchAgent `com.m3e.neo4j`（`com.m3e.neo4j.plist.template`、RunAtLoad・KeepAlive） | `/opt/homebrew/opt/neo4j/libexec/conf/neo4j.conf` |
| MacBook | Homebrew `neo4j` | `brew services`（`sh.brew.neo4j`、RunAtLoad） | 同上 |
| Windows | Neo4j Community の zip と Temurin JDK 21 を `%LOCALAPPDATA%\Programs\neo4j`・`jdk-21` に展開 | Startup の `M3E-autostart.vbs` が `%LOCALAPPDATA%\M3E\autostart\neo4j-console.cmd`（終了すれば 10 秒後に再起動）を窓なしで起動 | `%LOCALAPPDATA%\Programs\neo4j\conf\neo4j.conf` |

`neo4j.conf` で変えるのは次の 3 行だけ。`dbms.security.auth_enabled` は既定（有効）のままにする。

```
server.default_listen_address=127.0.0.1
dbms.usage_report.enabled=false
server.fleet_discovery.enabled=false
```

（`server.fleet_discovery.enabled` を切らないと、Neo4j は LAN に discovery の broadcast を送る。）Homebrew の `neo4j` を更新すると `libexec/conf/neo4j.conf` は新しい版の既定に戻るので、更新後に同じ行を入れ直す。

初回のパスワードは、Neo4j を起動したあと既定の `neo4j`／`neo4j` で接続し、`ALTER CURRENT USER SET PASSWORD FROM 'neo4j' TO '<file の値>'` を標準入力（`cypher-shell -d system`）か HTTP API（Windows には cypher-shell がない）で送って設定する。コマンド引数には載せない。確認は次のとおり。

```sh
NEO4J_PASSWORD="$(cat "$HOME/Library/Application Support/M3E/secrets/neo4j-password")" \
  cypher-shell -a bolt://127.0.0.1:7687 -u neo4j 'RETURN 1'
```

Mac mini の LaunchAgent の導入:

```sh
log_dir=$HOME/Library/Logs/M3E
mkdir -p /opt/homebrew/var/neo4j /opt/homebrew/var/log/neo4j   # WorkingDirectory が無いと launchd は EX_CONFIG で起動しない
sed "s#@LOG_DIR@#$log_dir#g" scripts/remote/com.m3e.neo4j.plist.template > "$HOME/Library/LaunchAgents/com.m3e.neo4j.plist"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.m3e.neo4j.plist"
```

`brew services start neo4j` は同じ Neo4j を二重に起動するので使わない。

Windows の Startup の `M3E-autostart.vbs` は、本番の Neo4j、試験用の Neo4j、通常 Beta の 3 つを窓なしで起動する。Beta 側の `%LOCALAPPDATA%\M3E\autostart\beta-logon.cmd` は 7687 番が待ち受けるまで最大 3 分待ち、`%USERPROFILE%\dev\M3E` の `scripts\beta\launch.bat` を実行して出力を `%TEMP%\m3e-beta-launch.log` に書く。Neo4j の 2 つの `.cmd` は、待ち受けがあれば 30 秒ごとに見直し、無ければ起動し、終了すれば 10 秒後に起動し直す。Startup はログオンで動くので、自動ログオンの無い Windows では再起動後に akaghef がログオンするまで何も起動しない。

### 試験用の Neo4j

単体試験と preflight は、実データを持つ 7687 番ではなく使い捨ての Neo4j（`M3E_TEST_NEO4J_BOLT`、既定 `bolt://127.0.0.1:7688`、認証なし）を使う。MacBook では同じ Homebrew の Neo4j を別の設定 directory（`~/Library/Application Support/M3E/neo4j-test/conf`、`NEO4J_CONF` で指定）で LaunchAgent `com.m3e.neo4j-test` として常駐させる。data・logs・run の directory も別にし（run を共有すると pid file が衝突して起動を拒む）、bolt を `127.0.0.1:7688`、HTTP を無効、heap を 512 MB に抑える。
Windows では `%LOCALAPPDATA%\M3E\neo4j-test\conf` を `NEO4J_CONF` にして、Startup から `neo4j-test-console.cmd` で同じように常駐させる。Mac mini には試験用の Neo4j を置かない（mini からは push しない）。

## Mac mini の初回導入

`swingby` でログインし、統合・検証済みの `dev-beta` がある `/Users/swingby/dev/M3E` を使う。Node.js 22 以降と npm を用意する。対象 workspace は移行済みで、`swingby` が読み書きできる `store/snapshot.jsonl` があることを確認する。同じ store を開く別のプロセスが停止している状態で実行する。

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
  # plutil -replace ProgramArguments.<n> inserts before index n instead of replacing; set the whole array.
  plutil -replace ProgramArguments -json "[\"$node_bin\",\"$checkout/beta/dist/node/start_viewer.js\"]" "$job"
  plutil -replace WorkingDirectory -string "$checkout/beta" "$job"
  plutil -replace EnvironmentVariables.M3E_DATA_DIR -string "$data_dir" "$job"
  plutil -replace EnvironmentVariables.M3E_STORE_DIR -string "$data_dir/store" "$job"
  plutil -replace EnvironmentVariables.M3E_TAILSCALE_USERS -string "$users" "$job"
  plutil -replace EnvironmentVariables.M3E_NEO4J_PASSWORD_FILE -string "$HOME/Library/Application Support/M3E/secrets/neo4j-password" "$job"
  plutil -replace StandardOutPath -string "$log_dir/remote-beta.log" "$job"
  plutil -replace StandardErrorPath -string "$log_dir/remote-beta.err.log" "$job"
  plutil -lint "$job"
  install -m 644 "$job" "$HOME/Library/LaunchAgents/com.m3e.remote-beta.plist"
  launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.m3e.remote-beta.plist"
  launchctl print "gui/$(id -u)/com.m3e.remote-beta"
)
```

LaunchAgent は `swingby` のログイン session（Mac mini は常時ログインしている）で `start_viewer.js` を直接起動し、`swingby` は sudo にパスワードが要るため LaunchDaemon にはしない。終了時は launchd が再起動する。サンプル生成とブラウザー起動を無効にし、明示した `M3E_STORE_DIR` を開けなければ起動に失敗する。

Serve は loopback の TCP へ転送する。

```sh
tailscale serve --bg http://127.0.0.1:4173
tailscale serve status
```

この構成では、Mac mini 上の process は 127.0.0.1:4173 に `Tailscale-User-Login` を付けて直接つなげる。akaghef は 2026-11-27 に、unix socket で閉じられない間は Mac mini 上の process を信頼すると決めた（実装ログの「Mac mini の remote は、mini 上の process からの loopback 接続で login を偽れる」）。

`M3E_LISTEN_SOCKET` に絶対パスを設定すると、M3E はその unix socket だけで待ち受け、`M3E_HOST`・`M3E_PORT` にかかわらず TCP は開かない。socket の mode は 0600 で、通常終了・SIGINT・SIGTERM・server close で消え、SIGKILL や電源断で残った socket は次の起動で消える。使用中の socket、通常ファイル、symlink は上書きしない。ただし Mac mini の Tailscale（`io.tailscale.ipn.macsys` の system extension）は、`tailscale serve --bg unix:<path>` を受け付けても、どの unix socket にも転送できず 502 を返す（`/tmp`、`/Users/Shared`、ホームの下で 2026-11-27 に確かめた）。この版では socket を使わない。sandbox でない `tailscaled` に替えた場合だけ、`M3E_LISTEN_SOCKET` を LaunchAgent に足して Serve を `unix:<path>` へ向け、`lsof -nP -iTCP:4173 -sTCP:LISTEN` が何も出さないことと、MacBook から Serve 越しに開けることを確かめる。

Serve の出力に表示される MagicDNS 名を MacBook で使う。

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
  plutil -replace ProgramArguments -json "[\"$node_bin\",\"$cli\",\"$remote_url\",\"$backup_dir\"]" "$job"
  plutil -replace StandardOutPath -string "$log_dir/remote-backup.log" "$job"
  plutil -replace StandardErrorPath -string "$log_dir/remote-backup.err.log" "$job"
  plutil -lint "$job"
  launchctl bootstrap "gui/$(id -u)" "$job"
  launchctl print "gui/$(id -u)/com.m3e.remote-backup"
)
```

バックアップは `/api/sync/clone` が返す `snapshotSeq` 時点の portable snapshot 全体を保存する。journal、commit index、archive は取得対象外。MacBook のスリープや tailnet 未接続が続けば、取得間隔は 1 時間を超える。復旧確認には別の空ディレクトリで `record_store_cli.js --create <dir> --from-snapshot <jsonl>` と `record_store_cli.js --verify <dir>` を使う。

## アクセス境界

Serve をネットワークからの唯一の入口として維持する。TCP loopback は待ち受けないため、Mac mini 上の別ユーザーの process が 127.0.0.1:4173 に header を付けて接続する経路はなくなる。socket の所有者である `swingby` と root は socket に直接接続できるため、この二者は引き続き信頼境界の内側である。0600 は同一ユーザーの process を隔離するものではない。

許可リストは workspace 全体と既存 API に対する入口で、許可するのは `swingby` のファイルにアクセスできる範囲まで信頼するログインに限る。既存のローカルファイル API も許可済み接続から呼び出せる。scope ごとの開示制御は対象外。照合した login は viewer／MCP Command の発行者アカウントの識別子として既存の journal `issuer` に記録し、`actor` は呼び出し元のラベルとして保持する。account record を作成する API は現状ないため、account record や新しい journal 欄は追加しない。許可リスト未設定・login header なし・local モードでは従来の issuer の選択を保つ。
