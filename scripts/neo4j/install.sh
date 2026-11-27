#!/bin/bash
# Per-user Neo4j for M3E on macOS (no admin). Idempotent: a rerun on an installed state changes
# nothing and says so. Versions come from scripts/neo4j/versions.env.
#
# Layout under <M3E home>/neo4j:
#   downloads/                 verified archives (Neo4j tarball, Temurin JRE)
#   dist/neo4j-community-<v>/  the Neo4j distribution, never edited
#   dist/temurin-jre-<v>/      the Java runtime
#   instances/main/            real data: bolt 127.0.0.1:7687, auth on, HTTP 127.0.0.1:7474
#   instances/test/            disposable test data: bolt 127.0.0.1:7688, auth off, no HTTP
# The main instance's password is generated once into <M3E home>/secrets/neo4j-password (0600)
# and never printed. Each instance runs as a LaunchAgent (RunAtLoad, KeepAlive).
set -euo pipefail

usage() {
  cat <<'EOF'
usage: install.sh [--home DIR] [--instances main,test] [--main-port N] [--main-http-port N]
                  [--test-port N] [--label-suffix S]
  --home            M3E home (default: $M3E_HOME or ~/Library/Application Support/M3E)
  --instances       which instances to install (default: main,test; the Mac mini uses main)
  --label-suffix    appended to the LaunchAgent labels (com.m3e.neo4j<S>, com.m3e.neo4j-test<S>)
EOF
}

HERE="$(cd "$(dirname "$0")" && pwd)"
NEO4J_VERSION="$(sed -n 's/^NEO4J_VERSION=//p' "$HERE/versions.env")"
TEMURIN_RELEASE="$(sed -n 's/^TEMURIN_RELEASE=//p' "$HERE/versions.env")"
[[ -n "$NEO4J_VERSION" && -n "$TEMURIN_RELEASE" ]] || { echo "versions.env is incomplete" >&2; exit 1; }

HOME_DIR="${M3E_HOME:-$HOME/Library/Application Support/M3E}"
INSTANCES="main,test"
MAIN_PORT=7687
MAIN_HTTP_PORT=7474
TEST_PORT=7688
LABEL_SUFFIX=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --home) HOME_DIR="$2"; shift 2 ;;
    --instances) INSTANCES="$2"; shift 2 ;;
    --main-port) MAIN_PORT="$2"; shift 2 ;;
    --main-http-port) MAIN_HTTP_PORT="$2"; shift 2 ;;
    --test-port) TEST_PORT="$2"; shift 2 ;;
    --label-suffix) LABEL_SUFFIX="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done
[[ "$(uname -s)" == "Darwin" ]] || { echo "install.sh is for macOS; use install.ps1 on Windows." >&2; exit 1; }

ROOT="$HOME_DIR/neo4j"
DOWNLOADS="$ROOT/downloads"
DIST="$ROOT/dist"
SECRETS="$HOME_DIR/secrets"
PASSWORD_FILE="$SECRETS/neo4j-password"
NEO4J_HOME="$DIST/neo4j-community-$NEO4J_VERSION"
TEMURIN_FILE_VERSION="${TEMURIN_RELEASE#jdk-}"; TEMURIN_FILE_VERSION="${TEMURIN_FILE_VERSION//+/_}"
TEMURIN_MAJOR="${TEMURIN_FILE_VERSION%%.*}"
JRE_DIR="$DIST/temurin-jre-$TEMURIN_FILE_VERSION"
JAVA_HOME_DIR="$JRE_DIR/Contents/Home"
CHANGES=0

log() { echo "[neo4j-install] $*"; }
changed() { CHANGES=$((CHANGES + 1)); log "changed: $*"; }
unchanged() { log "ok: $*"; }

case "$(uname -m)" in
  arm64) ARCH=aarch64 ;;
  x86_64) ARCH=x64 ;;
  *) echo "unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac

# Downloads $1 to $2 unless $2 already has the SHA-256 $3.
fetch_verified() {
  local url="$1" out="$2" sha="$3" tmp
  if [[ -f "$out" && "$(shasum -a 256 "$out" | cut -d' ' -f1)" == "$sha" ]]; then
    unchanged "download $(basename "$out")"
    return
  fi
  tmp="$out.part"
  curl -fsSL --retry 3 -o "$tmp" "$url"
  if [[ "$(shasum -a 256 "$tmp" | cut -d' ' -f1)" != "$sha" ]]; then
    rm -f "$tmp"
    echo "checksum mismatch for $url" >&2
    exit 1
  fi
  mv "$tmp" "$out"
  changed "downloaded $(basename "$out")"
}

# Extracts the archive $1 (one top directory) to $2 unless $2 exists.
extract_once() {
  local archive="$1" dest="$2" tmp
  if [[ -d "$dest" ]]; then
    unchanged "$(basename "$dest") present"
    return
  fi
  tmp="$(mktemp -d "$DIST/.extract.XXXXXX")"
  tar -xzf "$archive" -C "$tmp"
  mv "$tmp"/*/ "$dest"
  rmdir "$tmp"
  changed "extracted $(basename "$dest")"
}

# Writes $2 to the file $1 (mode $3) only when the content differs. Returns 0 when it wrote.
write_if_changed() {
  local file="$1" content="$2" mode="$3"
  if [[ -f "$file" ]] && [[ "$(cat "$file")" == "$content" ]]; then
    [[ "$(stat -f %Lp "$file")" == "$mode" ]] || chmod "$mode" "$file"
    return 1
  fi
  ( umask 077; printf '%s\n' "$content" > "$file.tmp" )
  chmod "$mode" "$file.tmp"
  mv "$file.tmp" "$file"
  return 0
}

xml_escape() { local s="$1"; s="${s//&/&amp;}"; s="${s//</&lt;}"; s="${s//>/&gt;}"; printf '%s' "$s"; }

port_listening() { nc -z 127.0.0.1 "$1" >/dev/null 2>&1; }

wait_for_port() {
  local port="$1" i
  for ((i = 0; i < 90; i++)); do
    port_listening "$port" && return 0
    sleep 2
  done
  return 1
}

cypher() { # cypher <port> <user or empty> <password> [database]; statement on stdin
  local port="$1" user="$2" password="$3" db="${4:-}"
  local args=(-a "bolt://127.0.0.1:$port" --format plain)
  [[ -n "$user" ]] && args+=(-u "$user")
  [[ -n "$db" ]] && args+=(-d "$db")
  if [[ -n "$user" ]]; then
    JAVA_HOME="$JAVA_HOME_DIR" NEO4J_PASSWORD="$password" "$NEO4J_HOME/bin/cypher-shell" "${args[@]}"
  else
    JAVA_HOME="$JAVA_HOME_DIR" "$NEO4J_HOME/bin/cypher-shell" "${args[@]}"
  fi
}

install -d -m 700 "$HOME_DIR" "$ROOT" "$DOWNLOADS" "$DIST"

# Neo4j distribution
neo4j_url="https://dist.neo4j.org/neo4j-community-$NEO4J_VERSION-unix.tar.gz"
neo4j_archive="$DOWNLOADS/neo4j-community-$NEO4J_VERSION-unix.tar.gz"
if [[ ! -d "$NEO4J_HOME" ]]; then
  fetch_verified "$neo4j_url" "$neo4j_archive" "$(curl -fsSL "$neo4j_url.sha256" | awk '{print $1}')"
fi
extract_once "$neo4j_archive" "$NEO4J_HOME"

# Java runtime
jre_name="OpenJDK${TEMURIN_MAJOR}U-jre_${ARCH}_mac_hotspot_${TEMURIN_FILE_VERSION}.tar.gz"
jre_url="https://github.com/adoptium/temurin${TEMURIN_MAJOR}-binaries/releases/download/${TEMURIN_RELEASE//+/%2B}/$jre_name"
if [[ ! -d "$JRE_DIR" ]]; then
  fetch_verified "$jre_url" "$DOWNLOADS/$jre_name" "$(curl -fsSL "$jre_url.sha256.txt" | awk '{print $1}')"
fi
extract_once "$DOWNLOADS/$jre_name" "$JRE_DIR"
[[ -x "$JAVA_HOME_DIR/bin/java" ]] || { echo "no java in $JAVA_HOME_DIR" >&2; exit 1; }

# Password of the main instance: generated once, never printed, never replaced.
if [[ ",$INSTANCES," == *",main,"* ]]; then
  install -d -m 700 "$SECRETS"
  chmod 700 "$SECRETS"
  if [[ -s "$PASSWORD_FILE" ]]; then
    unchanged "password file present"
  else
    ( umask 077; openssl rand -hex 24 > "$PASSWORD_FILE" )
    changed "generated the password file"
  fi
  chmod 600 "$PASSWORD_FILE"
fi

setup_instance() {
  local name="$1" port="$2" http_port="$3" auth="$4" heap="$5" pagecache="$6" label="$7"
  local dir="$ROOT/instances/$name" conf content plist restart=0 domain="gui/$(id -u)"
  install -d -m 700 "$dir" "$dir/conf" "$dir/data" "$dir/logs" "$dir/run" "$dir/import" "$dir/plugins"
  conf="$dir/conf"

  local http_lines="server.http.enabled=false"
  [[ -n "$http_port" ]] && http_lines="server.http.enabled=true
server.http.listen_address=127.0.0.1:$http_port
server.http.advertised_address=127.0.0.1:$http_port"
  content="# Generated by scripts/neo4j/install.sh (Neo4j $NEO4J_VERSION). Rerun the script instead of editing.
server.directories.data=$dir/data
server.directories.logs=$dir/logs
server.directories.run=$dir/run
server.directories.import=$dir/import
server.directories.plugins=$dir/plugins
server.default_listen_address=127.0.0.1
server.bolt.listen_address=127.0.0.1:$port
server.bolt.advertised_address=127.0.0.1:$port
$http_lines
server.https.enabled=false
dbms.security.auth_enabled=$auth
dbms.usage_report.enabled=false
server.fleet_discovery.enabled=false
server.memory.heap.initial_size=$heap
server.memory.heap.max_size=$heap
server.memory.pagecache.size=$pagecache
$(grep '^server.jvm.additional=' "$NEO4J_HOME/conf/neo4j.conf")"
  if write_if_changed "$conf/neo4j.conf" "$content" 600; then changed "$name: neo4j.conf"; restart=1; else unchanged "$name: neo4j.conf"; fi
  local f
  for f in server-logs.xml user-logs.xml neo4j-admin.conf; do
    if write_if_changed "$conf/$f" "$(cat "$NEO4J_HOME/conf/$f")" 600; then changed "$name: $f"; restart=1; else unchanged "$name: $f"; fi
  done

  plist="$HOME/Library/LaunchAgents/$label.plist"
  content="<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\">
<dict>
    <key>Label</key>
    <string>$label</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(xml_escape "$NEO4J_HOME/bin/neo4j")</string>
        <string>console</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NEO4J_HOME</key>
        <string>$(xml_escape "$NEO4J_HOME")</string>
        <key>NEO4J_CONF</key>
        <string>$(xml_escape "$conf")</string>
        <key>JAVA_HOME</key>
        <string>$(xml_escape "$JAVA_HOME_DIR")</string>
    </dict>
    <key>WorkingDirectory</key>
    <string>$(xml_escape "$dir")</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>$(xml_escape "$dir/logs/console.log")</string>
    <key>StandardErrorPath</key>
    <string>$(xml_escape "$dir/logs/console.log")</string>
</dict>
</plist>"
  install -d "$HOME/Library/LaunchAgents"
  local plist_changed=0
  if write_if_changed "$plist" "$content" 644; then plist_changed=1; changed "$name: LaunchAgent $label"; else unchanged "$name: LaunchAgent $label"; fi

  if launchctl print "$domain/$label" >/dev/null 2>&1; then
    if [[ $plist_changed == 1 ]]; then
      launchctl bootout "$domain/$label" || true
      # bootout returns before the job is gone; bootstrap fails with EIO until it is.
      local i
      for ((i = 0; i < 60; i++)); do
        launchctl print "$domain/$label" >/dev/null 2>&1 || break
        sleep 1
      done
      for ((i = 0; i < 30; i++)); do
        port_listening "$port" || break
        sleep 1
      done
      launchctl bootstrap "$domain" "$plist"
      changed "$name: reloaded $label"
    elif [[ $restart == 1 ]]; then
      launchctl kickstart -k "$domain/$label"
      changed "$name: restarted $label"
    else
      unchanged "$name: $label loaded"
    fi
  else
    if port_listening "$port"; then
      echo "port $port is already taken by a process that is not $label; stop it first." >&2
      exit 1
    fi
    launchctl bootstrap "$domain" "$plist"
    changed "$name: started $label"
  fi
  wait_for_port "$port" || { echo "$name: bolt 127.0.0.1:$port did not open; see $dir/logs" >&2; exit 1; }

  if [[ "$auth" == "true" ]]; then
    local password
    password="$(cat "$PASSWORD_FILE")"
    if echo 'RETURN 1;' | cypher "$port" neo4j "$password" >/dev/null 2>&1; then
      unchanged "$name: neo4j logs in with the password file"
    else
      # First start: the default password must be changed before anything else is allowed.
      local statement
      statement="ALTER CURRENT USER SET PASSWORD FROM 'neo4j' TO '$password';"
      local i
      for ((i = 0; i < 15; i++)); do
        echo "$statement" | cypher "$port" neo4j neo4j system >/dev/null 2>&1 && break
        sleep 2
      done
      echo 'RETURN 1;' | cypher "$port" neo4j "$password" >/dev/null 2>&1 ||
        { echo "$name: cannot log in with the password file and the default password was not accepted." >&2; exit 1; }
      changed "$name: set the password from the password file"
    fi
  else
    echo 'RETURN 1;' | cypher "$port" "" "" >/dev/null 2>&1 || { echo "$name: RETURN 1 failed on $port" >&2; exit 1; }
    unchanged "$name: answers without auth"
  fi
}

IFS=',' read -r -a wanted <<< "$INSTANCES"
for instance in "${wanted[@]}"; do
  case "$instance" in
    main) setup_instance main "$MAIN_PORT" "$MAIN_HTTP_PORT" true 512m 256m "com.m3e.neo4j$LABEL_SUFFIX" ;;
    test) setup_instance test "$TEST_PORT" "" false 512m 128m "com.m3e.neo4j-test$LABEL_SUFFIX" ;;
    *) echo "unknown instance: $instance" >&2; exit 2 ;;
  esac
done

if [[ $CHANGES == 0 ]]; then
  log "no changes: Neo4j $NEO4J_VERSION already installed and running ($INSTANCES)"
else
  log "$CHANGES change(s) applied"
fi
