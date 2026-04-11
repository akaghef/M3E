#!/bin/bash
set -euo pipefail

: "${SESSION_PREFIX:?SESSION_PREFIX is required}"
: "${SESSION_DISPLAY_NAME:=Claude}"
: "${LOG_ROOT:=$HOME/.claude/projects}"
: "${STATE_ROOT:=${XDG_CACHE_HOME:-$HOME/.cache}/ai-agent-sessions}"
: "${EXEC_TIMEOUT_SECONDS:=1200}"
: "${FALLBACK_MAX_LINES:=100}"

SESSION_LOCK_KIND=""
SESSION_LOCK_FD=""
SESSION_LOCK_DIR=""

ensure_dependencies() {
  if ! command -v claude >/dev/null 2>&1; then
    echo "Error: claude コマンドが見つかりません。" >&2
    exit 1
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    echo "Error: python3 コマンドが見つかりません。" >&2
    exit 1
  fi
}

validate_positive_integer() {
  local value="$1"
  local key="$2"
  if ! [[ "$value" =~ ^[1-9][0-9]*$ ]]; then
    echo "Error: $key は正の整数を指定してください: $value" >&2
    exit 1
  fi
}

ensure_state_root() {
  mkdir -p "$STATE_ROOT"
}

session_file() {
  local name="$1"
  echo "$STATE_ROOT/${SESSION_PREFIX}${name}"
}

meta_file() {
  local name="$1"
  echo "$STATE_ROOT/${SESSION_PREFIX}${name}.meta"
}

lock_file() {
  local name="$1"
  echo "$STATE_ROOT/${SESSION_PREFIX}${name}.lock"
}

validate_name() {
  local name="$1"
  if [[ -z "$name" ]]; then
    echo "Error: セッション名が必要です" >&2
    exit 1
  fi
  if ! [[ "$name" =~ ^[A-Za-z0-9_-]+$ ]]; then
    echo "Error: セッション名は英数字・'_'・'-' のみ使用できます: $name" >&2
    exit 1
  fi
}

save_meta() {
  local name="$1"
  local sid="$2"
  local log_path="${3:-}"
  local mf
  mf="$(meta_file "$name")"

  {
    echo "session_id=$sid"
    echo "log_path=$log_path"
    echo "updated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "$mf"
}

read_meta_value() {
  local name="$1"
  local key="$2"
  local mf
  mf="$(meta_file "$name")"

  if [[ ! -f "$mf" ]]; then
    return 0
  fi

  awk -F= -v k="$key" '$1==k {sub($1"=", "", $0); print; exit}' "$mf" || true
}

find_log_by_session_id() {
  local sid="$1"
  find "$LOG_ROOT" -type f -name "${sid}.jsonl" 2>/dev/null | sort | tail -n 1
}

extract_session_id_from_start_output() {
  local output_file="$1"
  python3 - "$output_file" <<'PY'
import json
import re
import sys

raw = ""
try:
    with open(sys.argv[1], "r", encoding="utf-8", errors="ignore") as f:
        raw = f.read()
except Exception:
    pass

sid = ""
if raw:
    try:
        data = json.loads(raw)
        v = data.get("session_id")
        if isinstance(v, str):
            sid = v
    except Exception:
        pass

if not sid and raw:
    m = re.search(r'"session_id"\s*:\s*"([^"]+)"', raw)
    if m:
        sid = m.group(1)

if sid:
    print(sid)
PY
}

extract_result_from_start_output() {
  local output_file="$1"
  python3 - "$output_file" <<'PY'
import json
import sys

raw = ""
try:
    with open(sys.argv[1], "r", encoding="utf-8", errors="ignore") as f:
        raw = f.read()
except Exception:
    pass

if not raw:
    sys.exit(0)

try:
    data = json.loads(raw)
except Exception:
    sys.exit(0)

result = data.get("result")
if isinstance(result, str) and result:
    print(result)
PY
}

extract_last_output_from_log() {
  local log_file="$1"
  python3 - "$log_file" <<'PY'
import json
import sys

path = sys.argv[1]
last_text = ""

try:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except Exception:
                continue

            if data.get("type") != "assistant":
                continue

            message = data.get("message") or {}
            content = message.get("content") or []
            if not isinstance(content, list):
                continue

            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    text = item.get("text")
                    if isinstance(text, str) and text:
                        last_text = text
except Exception:
    pass

if last_text:
    print(last_text)
PY
}

print_bounded_output() {
  local output_file="$1"
  local line_count

  if [[ ! -f "$output_file" ]]; then
    return 0
  fi

  line_count="$(wc -l < "$output_file" | tr -d '[:space:]')"
  if [[ -z "$line_count" ]]; then
    line_count=0
  fi

  if (( line_count <= FALLBACK_MAX_LINES )); then
    cat "$output_file"
    return 0
  fi

  echo "[TRUNCATED: showing last ${FALLBACK_MAX_LINES} lines (total: ${line_count})]"
  tail -n "$FALLBACK_MAX_LINES" "$output_file"
}

run_with_timeout() {
  local output_file="$1"
  shift

  if command -v gtimeout >/dev/null 2>&1; then
    gtimeout "$EXEC_TIMEOUT_SECONDS" "$@" >"$output_file" 2>&1
    return $?
  fi

  if command -v timeout >/dev/null 2>&1; then
    timeout "$EXEC_TIMEOUT_SECONDS" "$@" >"$output_file" 2>&1
    return $?
  fi

  python3 - "$EXEC_TIMEOUT_SECONDS" "$output_file" "$@" <<'PY'
import subprocess
import sys

timeout_seconds = int(sys.argv[1])
output_path = sys.argv[2]
cmd = sys.argv[3:]

if not cmd:
    sys.exit(2)

with open(output_path, "wb") as f:
    try:
        proc = subprocess.run(
            cmd,
            stdout=f,
            stderr=subprocess.STDOUT,
            timeout=timeout_seconds,
            check=False,
        )
        sys.exit(proc.returncode)
    except subprocess.TimeoutExpired:
        sys.exit(124)
PY
}

acquire_session_lock() {
  local name="$1"
  local lock_path
  lock_path="$(lock_file "$name")"

  ensure_state_root

  if command -v flock >/dev/null 2>&1; then
    exec 200> "$lock_path"
    if ! flock -n 200; then
      exec 200>&-
      echo "Error: Session '$name' は他の処理で使用中です。" >&2
      return 1
    fi
    SESSION_LOCK_KIND="flock"
    SESSION_LOCK_FD="200"
    return 0
  fi

  local lock_dir="${lock_path}.d"
  if ! mkdir "$lock_dir" 2>/dev/null; then
    echo "Error: Session '$name' は他の処理で使用中です。" >&2
    return 1
  fi

  SESSION_LOCK_KIND="mkdir"
  SESSION_LOCK_DIR="$lock_dir"
  return 0
}

release_session_lock() {
  if [[ "${SESSION_LOCK_KIND:-}" == "flock" && -n "${SESSION_LOCK_FD:-}" ]]; then
    flock -u "$SESSION_LOCK_FD" 2>/dev/null || true
    eval "exec ${SESSION_LOCK_FD}>&-"
  fi

  if [[ "${SESSION_LOCK_KIND:-}" == "mkdir" && -n "${SESSION_LOCK_DIR:-}" ]]; then
    rmdir "$SESSION_LOCK_DIR" 2>/dev/null || true
  fi

  SESSION_LOCK_KIND=""
  SESSION_LOCK_FD=""
  SESSION_LOCK_DIR=""
}

cmd_start() {
  local name="${1:-}"
  local prompt="${2:-}"

  if [[ -z "$name" || -z "$prompt" ]]; then
    echo "Usage: start <name> \"<prompt>\"" >&2
    exit 1
  fi

  validate_name "$name"

  local sf
  sf="$(session_file "$name")"

  if [[ -f "$sf" ]]; then
    echo "Warning: Session '$name' already exists. Overwriting."
  fi

  if ! acquire_session_lock "$name"; then
    exit 1
  fi

  local tmp=""
  trap 'release_session_lock; [[ -n "${tmp:-}" ]] && rm -f "$tmp"' RETURN

  echo "Creating ${SESSION_DISPLAY_NAME} session '$name'..."

  tmp="$(mktemp)"

  if run_with_timeout "$tmp" claude -p --output-format json "$prompt"; then
    :
  else
    local rc=$?
    if [[ $rc -eq 124 ]]; then
      echo "Error: claude timed out after ${EXEC_TIMEOUT_SECONDS}s" >&2
    else
      echo "Error: claude failed (exit: $rc)" >&2
    fi
    echo "--- 最後の50行 ---" >&2
    tail -n 50 "$tmp" >&2
    exit 1
  fi

  local sid
  sid="$(extract_session_id_from_start_output "$tmp")"

  if [[ -z "$sid" ]]; then
    echo "Error: Failed to get session ID" >&2
    echo "" >&2
    echo "---- claude output (raw) ----" >&2
    print_bounded_output "$tmp" >&2
    exit 1
  fi

  echo "$sid" > "$sf"
  echo "Session '$name' created: $sid"

  local log_path
  log_path="$(find_log_by_session_id "$sid")"
  save_meta "$name" "$sid" "$log_path"

  if [[ -n "$log_path" && -f "$log_path" ]]; then
    echo "📁 ログ: $log_path"
    echo ""
    local last
    last="$(extract_last_output_from_log "$log_path")"
    if [[ -n "$last" ]]; then
      echo "$last"
    else
      echo "Warning: 回答が抽出できませんでした。resultにフォールバックします。" >&2
      local result
      result="$(extract_result_from_start_output "$tmp")"
      if [[ -n "$result" ]]; then
        echo "$result"
      else
        print_bounded_output "$tmp"
      fi
    fi
  else
    echo "Warning: セッションログが見つかりません。resultにフォールバックします。" >&2
    echo ""
    local result
    result="$(extract_result_from_start_output "$tmp")"
    if [[ -n "$result" ]]; then
      echo "$result"
    else
      print_bounded_output "$tmp"
    fi
  fi

  trap - RETURN
  release_session_lock
  rm -f "$tmp"
}

cmd_send() {
  local name="${1:-}"
  local prompt="${2:-}"

  if [[ -z "$name" || -z "$prompt" ]]; then
    echo "Usage: send <name> \"<prompt>\"" >&2
    exit 1
  fi

  validate_name "$name"

  if ! acquire_session_lock "$name"; then
    exit 1
  fi

  local tmp=""
  trap 'release_session_lock; [[ -n "${tmp:-}" ]] && rm -f "$tmp"' RETURN

  local sf
  sf="$(session_file "$name")"

  if [[ ! -f "$sf" ]]; then
    echo "Error: Session '$name' not found." >&2
    echo "Create it first with: start.sh $name \"<initial prompt>\"" >&2
    exit 1
  fi

  local sid
  sid="$(cat "$sf")"
  if [[ -z "$sid" ]]; then
    echo "Error: Session file is empty: $sf" >&2
    exit 1
  fi

  echo "Resuming ${SESSION_DISPLAY_NAME} session '$name' ($sid)..."

  tmp="$(mktemp)"

  if run_with_timeout "$tmp" claude -r "$sid" -p "$prompt"; then
    :
  else
    local rc=$?
    if [[ $rc -eq 124 ]]; then
      echo "Error: claude timed out after ${EXEC_TIMEOUT_SECONDS}s" >&2
    else
      echo "Error: claude failed (exit: $rc)" >&2
    fi
    echo "--- 最後の50行 ---" >&2
    tail -n 50 "$tmp" >&2
    exit 1
  fi

  local log_path
  log_path="$(read_meta_value "$name" "log_path")"
  if [[ -z "$log_path" || ! -f "$log_path" ]]; then
    log_path="$(find_log_by_session_id "$sid")"
  fi

  save_meta "$name" "$sid" "$log_path"

  if [[ -n "$log_path" && -f "$log_path" ]]; then
    echo "📁 ログ: $log_path"
    echo ""
    local last
    last="$(extract_last_output_from_log "$log_path")"
    if [[ -n "$last" ]]; then
      echo "$last"
    else
      echo "Warning: 回答が抽出できませんでした。出力を上限付きで表示します。" >&2
      print_bounded_output "$tmp"
    fi
  else
    echo "Warning: セッションログが見つかりません。出力を上限付きで表示します。" >&2
    print_bounded_output "$tmp"
  fi

  trap - RETURN
  release_session_lock
  rm -f "$tmp"
}

cmd_list() {
  echo "=== Saved ${SESSION_DISPLAY_NAME} Sessions ==="
  echo ""

  local found=0
  local f name id

  shopt -s nullglob
  for f in "$STATE_ROOT/${SESSION_PREFIX}"*; do
    if [[ ! -f "$f" ]]; then
      continue
    fi
    if [[ "$f" == *.meta || "$f" == *.lock ]]; then
      continue
    fi

    found=1
    name="$(basename "$f")"
    name="${name#${SESSION_PREFIX}}"
    id="$(cat "$f")"

    echo "[claude] $name"
    echo "  ID: $id"
    echo ""
  done

  if [[ $found -eq 0 ]]; then
    echo "No sessions found."
    echo ""
    echo "Create one with:"
    echo "  start.sh <name> \"<prompt>\""
  fi
}

cmd_clear() {
  local arg="${1:-}"

  if [[ -z "$arg" ]]; then
    echo "Usage: clear <name> | --all" >&2
    exit 1
  fi

  if [[ "$arg" == "--all" ]]; then
    local count=0
    local f
    shopt -s nullglob
    for f in "$STATE_ROOT/${SESSION_PREFIX}"*; do
      if [[ -f "$f" ]]; then
        rm "$f"
        count=$((count + 1))
      fi
    done
    echo "Cleared $count file(s)."
    exit 0
  fi

  validate_name "$arg"

  local sf mf removed
  sf="$(session_file "$arg")"
  mf="$(meta_file "$arg")"
  removed=0

  if [[ -f "$sf" ]]; then
    rm "$sf"
    removed=1
  fi
  if [[ -f "$mf" ]]; then
    rm "$mf"
    removed=1
  fi

  if [[ $removed -eq 1 ]]; then
    echo "Session '$arg' cleared."
  else
    echo "Session '$arg' not found." >&2
    exit 1
  fi
}

main() {
  ensure_dependencies
  validate_positive_integer "$EXEC_TIMEOUT_SECONDS" "EXEC_TIMEOUT_SECONDS"
  validate_positive_integer "$FALLBACK_MAX_LINES" "FALLBACK_MAX_LINES"
  ensure_state_root

  local action="${1:-}"
  shift || true

  case "$action" in
    start)
      cmd_start "$@"
      ;;
    send)
      cmd_send "$@"
      ;;
    list)
      cmd_list "$@"
      ;;
    clear)
      cmd_clear "$@"
      ;;
    *)
      echo "Usage: $(basename "$0") {start|send|list|clear} ..." >&2
      exit 1
      ;;
  esac
}

main "$@"
