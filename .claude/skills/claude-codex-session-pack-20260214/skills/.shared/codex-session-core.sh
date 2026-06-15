#!/bin/bash
set -euo pipefail

: "${SESSION_PREFIX:?SESSION_PREFIX is required}"
: "${MODEL:?MODEL is required}"
: "${SESSION_DISPLAY_NAME:=Codex}"
: "${REASONING_EFFORT:=}"
: "${LOG_ROOT:=$HOME/.codex/sessions}"
: "${STATE_ROOT:=${XDG_CACHE_HOME:-$HOME/.cache}/ai-agent-sessions}"
: "${EXEC_TIMEOUT_SECONDS:=1200}"
: "${FALLBACK_MAX_LINES:=100}"

SESSION_LOCK_KIND=""
SESSION_LOCK_FD=""
SESSION_LOCK_DIR=""

ensure_dependencies() {
  if ! command -v codex >/dev/null 2>&1; then
    echo "Error: codex コマンドが見つかりません。" >&2
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

validate_reasoning_effort() {
  local effort="$1"
  if [[ -z "$effort" ]]; then
    return 0
  fi

  case "$effort" in
    low|medium|high|xhigh)
      ;;
    *)
      echo "Error: REASONING_EFFORT は low|medium|high|xhigh を指定してください: $effort" >&2
      exit 1
      ;;
  esac
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

usage_start() {
  cat <<EOF2
使い方:
  start [--cd <dir>] <name> "<prompt>"

オプション:
  --cd <dir>  Codex の作業ディレクトリを指定する（内部で codex exec -C <dir> を使う）
EOF2
}

usage_send() {
  cat <<EOF2
使い方:
  send [--cd <dir>] <name> "<prompt>"

オプション:
  --cd <dir>  Codex の作業ディレクトリを指定する（省略時は start 時の設定を再利用）
EOF2
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

parse_cd_args() {
  WORK_DIR=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --cd)
        if [[ -z "${2:-}" ]]; then
          echo "Error: --cd にはディレクトリを指定してください" >&2
          exit 1
        fi
        WORK_DIR="$2"
        shift 2
        ;;
      -h|--help)
        usage_start
        exit 0
        ;;
      -*)
        echo "Error: 不明なオプション: $1" >&2
        exit 1
        ;;
      *)
        break
        ;;
    esac
  done

  NAME="${1:-}"
  PROMPT="${2:-}"
}

save_meta() {
  local name="$1"
  local sid="$2"
  local work_dir="${3:-}"
  local log_path="${4:-}"
  local mf
  mf="$(meta_file "$name")"

  {
    echo "session_id=$sid"
    echo "work_dir=$work_dir"
    echo "log_path=$log_path"
    echo "model=$MODEL"
    echo "reasoning_effort=$REASONING_EFFORT"
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
  find "$LOG_ROOT" -type f -name "*${sid}.jsonl" 2>/dev/null | sort | tail -n 1
}

extract_session_id_from_output() {
  local output_file="$1"
  python3 - "$output_file" <<'PY'
import json
import sys

path = sys.argv[1]
sid = ""

try:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except Exception:
                continue
            if data.get("type") == "thread.started":
                thread_id = data.get("thread_id")
                if isinstance(thread_id, str) and thread_id:
                    sid = thread_id
                    break
except Exception:
    pass

if sid:
    print(sid)
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

            payload = data.get("payload") or {}
            content = payload.get("content") or []
            if not isinstance(content, list):
                continue

            for item in content:
                if isinstance(item, dict) and item.get("type") == "output_text":
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
  parse_cd_args "$@"

  if [[ -z "$NAME" || -z "$PROMPT" ]]; then
    usage_start >&2
    exit 1
  fi

  validate_name "$NAME"

  if [[ -n "$WORK_DIR" && ! -d "$WORK_DIR" ]]; then
    echo "Error: ディレクトリが存在しません: $WORK_DIR" >&2
    exit 1
  fi

  local sf
  sf="$(session_file "$NAME")"
  if [[ -f "$sf" ]]; then
    echo "Warning: Session '$NAME' already exists. Overwriting."
  fi

  if ! acquire_session_lock "$NAME"; then
    exit 1
  fi

  local tmp=""
  trap 'release_session_lock; [[ -n "${tmp:-}" ]] && rm -f "$tmp"' RETURN

  echo "Creating ${SESSION_DISPLAY_NAME} session '$NAME'..."

  tmp="$(mktemp)"

  local cmd=(codex exec --json --model "$MODEL")
  if [[ -n "$REASONING_EFFORT" ]]; then
    cmd+=(-c "model_reasoning_effort=\"$REASONING_EFFORT\"")
  fi
  if [[ -n "$WORK_DIR" ]]; then
    cmd+=(-C "$WORK_DIR")
  fi
  cmd+=("$PROMPT")

  if run_with_timeout "$tmp" "${cmd[@]}"; then
    :
  else
    local rc=$?
    if [[ $rc -eq 124 ]]; then
      echo "Error: codex exec timed out after ${EXEC_TIMEOUT_SECONDS}s" >&2
    else
      echo "Error: codex exec failed (exit: $rc)" >&2
    fi
    echo "--- 最後の50行 ---" >&2
    tail -n 50 "$tmp" >&2
    exit 1
  fi

  local sid
  sid="$(extract_session_id_from_output "$tmp")"

  if [[ -z "$sid" ]]; then
    echo "Error: Failed to get session ID" >&2
    echo "" >&2
    echo "---- codex output (raw) ----" >&2
    print_bounded_output "$tmp" >&2
    exit 1
  fi

  echo "$sid" > "$sf"
  echo "Session '$NAME' created: $sid"

  local log_path
  log_path="$(find_log_by_session_id "$sid")"
  save_meta "$NAME" "$sid" "$WORK_DIR" "$log_path"

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
    echo ""
    print_bounded_output "$tmp"
  fi

  trap - RETURN
  release_session_lock
  rm -f "$tmp"
}

cmd_send() {
  parse_cd_args "$@"

  if [[ -z "$NAME" || -z "$PROMPT" ]]; then
    usage_send >&2
    exit 1
  fi

  validate_name "$NAME"

  if ! acquire_session_lock "$NAME"; then
    exit 1
  fi

  local tmp=""
  trap 'release_session_lock; [[ -n "${tmp:-}" ]] && rm -f "$tmp"' RETURN

  local sf
  sf="$(session_file "$NAME")"

  if [[ ! -f "$sf" ]]; then
    echo "Error: Session '$NAME' not found." >&2
    echo "Create it first with: start.sh $NAME \"<initial prompt>\"" >&2
    exit 1
  fi

  local sid
  sid="$(cat "$sf")"
  if [[ -z "$sid" ]]; then
    echo "Error: Session file is empty: $sf" >&2
    exit 1
  fi

  # --cd を省略した場合は、start 時の作業ディレクトリを再利用する。
  if [[ -z "$WORK_DIR" ]]; then
    WORK_DIR="$(read_meta_value "$NAME" "work_dir")"
  fi

  if [[ -n "$WORK_DIR" && ! -d "$WORK_DIR" ]]; then
    echo "Error: ディレクトリが存在しません: $WORK_DIR" >&2
    exit 1
  fi

  echo "Resuming ${SESSION_DISPLAY_NAME} session '$NAME' ($sid)..."

  tmp="$(mktemp)"

  local cmd=(codex exec --json --model "$MODEL")
  if [[ -n "$REASONING_EFFORT" ]]; then
    cmd+=(-c "model_reasoning_effort=\"$REASONING_EFFORT\"")
  fi
  if [[ -n "$WORK_DIR" ]]; then
    cmd+=(-C "$WORK_DIR")
  fi
  cmd+=(resume "$sid" "$PROMPT")

  if run_with_timeout "$tmp" "${cmd[@]}"; then
    :
  else
    local rc=$?
    if [[ $rc -eq 124 ]]; then
      echo "Error: codex exec timed out after ${EXEC_TIMEOUT_SECONDS}s" >&2
    else
      echo "Error: codex exec failed (exit: $rc)" >&2
    fi
    echo "--- 最後の50行 ---" >&2
    tail -n 50 "$tmp" >&2
    exit 1
  fi

  local log_path
  log_path="$(read_meta_value "$NAME" "log_path")"
  if [[ -z "$log_path" || ! -f "$log_path" ]]; then
    log_path="$(find_log_by_session_id "$sid")"
  fi

  save_meta "$NAME" "$sid" "$WORK_DIR" "$log_path"

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
  local f name id wd

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

    echo "[codex] $name"
    echo "  ID: $id"

    wd="$(read_meta_value "$name" "work_dir")"
    if [[ -n "$wd" ]]; then
      echo "  DIR: $wd"
    fi

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
  validate_reasoning_effort "$REASONING_EFFORT"
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
