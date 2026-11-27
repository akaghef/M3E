# Mac mini で Beta workspace を運用する

Mac mini が Beta workspace の record store を保持する。ブラウザーと MCP は Tailscale Serve の HTTPS URL に接続する。各端末のデータ用 clone はこの段階では作らない。MacBook のバックアップは復旧用の JSONL ファイルとして保管する。

## 各端末の Neo4j

record store の Neo4j は、端末ごとに利用者権限だけで `scripts/neo4j/install.sh`（macOS）と `scripts/neo4j/install.ps1`（Windows）が導入する。何度実行してもよい。導入済みの状態で実行すると何も変えず、最後に `no changes` と出す。版は `scripts/neo4j/versions.env` の 1 か所で固定する（Neo4j と Eclipse Temurin の JRE）。CI の Neo4j service image（`neo4j:<版>-community`）がこの版と違えば installer-lint が失敗する。

```sh
scripts/neo4j/install.sh                    # MacBook: main と test
scripts/neo4j/install.sh --instances main   # Mac mini: main だけ（mini からは push しないので test は置かない）
```

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\neo4j\install.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\beta\install-logon-start.ps1
```

導入先は M3E home（macOS は `~/Library/Application Support/M3E`、Windows は `%LOCALAPPDATA%\M3E`、`M3E_HOME` か `--home`／`-M3eHome` で変えられる）の `neo4j` の下。

| 置き場所 | 中身 |
|---|---|
| `neo4j/downloads/` | checksum を照合した Neo4j の tarball（Windows は zip）と Temurin JRE |
| `neo4j/dist/` | 展開した Neo4j と JRE。編集しない |
| `neo4j/instances/main/` | 実データ。bolt `127.0.0.1:7687`、認証あり、HTTP `127.0.0.1:7474`、heap 512 MB |
| `neo4j/instances/test/` | 試験用の使い捨てデータ。bolt `127.0.0.1:7688`、認証なし、HTTP なし、heap 512 MB |
| `secrets/neo4j-password` | main の `neo4j` 利用者のパスワード。初回に生成し、以後は置き換えない。macOS は 0600、Windows は本人だけの ACL |

各 instance の `conf/neo4j.conf` は script が生成し、loopback だけで待ち受け、利用データの送信（`dbms.usage_report`）と LAN への discovery の broadcast（`server.fleet_discovery`）を止める。手で直さず、script を直して流し直す。conf が変われば script がその instance を起動し直す。main の初回は、既定の `neo4j`／`neo4j` で接続してパスワードを file の値に変える。パスワードはコマンド引数にも出力にも出さない（macOS は標準入力、Windows は本人だけが読める一時 file を `cypher-shell -f` で渡す）。

常駐のさせ方:

- macOS: LaunchAgent `com.m3e.neo4j` と `com.m3e.neo4j-test`（RunAtLoad・KeepAlive・ThrottleInterval 10 秒）。plist が変わったときは、古い job が消えるのを待ってから入れ直す。
- Windows: instance ごとの `start.cmd` が見張り役になる。待ち受けがあれば 30 秒ごとに見直し、無ければ Neo4j を起動し、終了すれば 10 秒後に起動し直す。ログオン時は Startup の `M3E-neo4j.vbs`・`M3E-neo4j-test.vbs` が窓なしで起動する。導入時に見張り役が動いていなければ、ssh の session が終わっても残る process として起動する。
- Windows の通常 Beta: `scripts\beta\install-logon-start.ps1` が `%LOCALAPPDATA%\M3E\autostart\beta-logon.cmd` と Startup の `M3E-beta.vbs` を置く。beta-logon.cmd は 7687 番が待ち受けるまで最大 3 分待ち、その checkout の `scripts\beta\launch.bat` を実行して出力を `%TEMP%\m3e-beta-launch.log` に書く。Startup はログオンで動くので、自動ログオンの無い Windows では再起動後に akaghef がログオンするまで何も起動しない。

Beta サーバーには `M3E_NEO4J_BOLT`・`M3E_NEO4J_USER`・`M3E_NEO4J_PASSWORD_FILE` を渡し、パスワードの値そのものは環境変数にも launcher にも書かない。`scripts/beta/launch.sh`・`launch.bat` は、パスワード file があればその path を渡す。単体試験と preflight は実データの 7687 番ではなく `M3E_TEST_NEO4J_BOLT=bolt://127.0.0.1:7688` を使う。

確認は次のとおり（`JAVA_HOME` は導入した JRE）。

```sh
h="$HOME/Library/Application Support/M3E/neo4j"
NEO4J_PASSWORD="$(cat "$h/../secrets/neo4j-password")" JAVA_HOME="$h/dist/temurin-jre-21.0.13.1_2/Contents/Home" \
  "$h/dist/neo4j-community-2026.10.2/bin/cypher-shell" -a bolt://127.0.0.1:7687 -u neo4j 'RETURN 1'
```

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
