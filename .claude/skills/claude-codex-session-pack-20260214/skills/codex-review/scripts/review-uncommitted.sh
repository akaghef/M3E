#!/bin/bash
set -euo pipefail
set +m

WORK_DIR=""
MODEL="gpt-5.3-codex"
PROMPT=""
MAX_WAIT_SECONDS=1200

usage() {
  cat <<USAGE
使い方:
  review-uncommitted.sh [--cd <dir>] [--model <model>] [--max-wait-seconds <seconds>] [--prompt "<追加指示>"]

例:
  review-uncommitted.sh --cd /path/to/repo --model gpt-5.3-codex --max-wait-seconds 1200 --prompt "Critical/Warningのみ"
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cd)
      WORK_DIR="${2:-}"
      shift 2
      ;;
    --model)
      MODEL="${2:-}"
      shift 2
      ;;
    --max-wait-seconds)
      MAX_WAIT_SECONDS="${2:-}"
      shift 2
      ;;
    --prompt)
      PROMPT="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: 不明な引数: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -n "$WORK_DIR" && ! -d "$WORK_DIR" ]]; then
  echo "Error: ディレクトリが存在しません: $WORK_DIR" >&2
  exit 1
fi

if ! [[ "$MAX_WAIT_SECONDS" =~ ^[0-9]+$ ]] || (( MAX_WAIT_SECONDS <= 0 )); then
  echo "Error: --max-wait-seconds には1以上の整数を指定してください" >&2
  exit 1
fi

TMP_OUT="$(mktemp)"
trap 'rm -f "$TMP_OUT"' EXIT

cmd=(codex review --uncommitted -c "model=\"$MODEL\"")

if [[ -n "$PROMPT" ]]; then
  echo "Warning: codex review --uncommitted は追加PROMPT非対応のため --prompt は無視します" >&2
fi

run_review() {
  "${cmd[@]}"
}

terminate_review_process() {
  local pid="$1"
  local children

  children="$(pgrep -P "$pid" 2>/dev/null || true)"
  if [[ -n "$children" ]]; then
    while IFS= read -r child_pid; do
      if [[ -n "$child_pid" ]]; then
        kill "$child_pid" 2>/dev/null || true
      fi
    done <<< "$children"
  else
    kill "$pid" 2>/dev/null || true
  fi

  sleep 1

  children="$(pgrep -P "$pid" 2>/dev/null || true)"
  if [[ -n "$children" ]]; then
    while IFS= read -r child_pid; do
      if [[ -n "$child_pid" ]]; then
        kill -9 "$child_pid" 2>/dev/null || true
      fi
    done <<< "$children"
  fi

  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
}

if [[ -n "$WORK_DIR" ]]; then
  (
    cd "$WORK_DIR"
    run_review
  ) >"$TMP_OUT" 2>&1 &
else
  run_review >"$TMP_OUT" 2>&1 &
fi

review_pid="$!"
review_exit=0
timed_out=0
poll_interval=10
start_at="$(date +%s)"

echo "[codex-review] review開始 (timeout: ${MAX_WAIT_SECONDS}s)" >&2

while kill -0 "$review_pid" 2>/dev/null; do
  now="$(date +%s)"
  elapsed=$((now - start_at))

  if (( elapsed >= MAX_WAIT_SECONDS )); then
    timed_out=1
    echo "[codex-review] タイムアウト到達 (${elapsed}s)。レビューを停止して部分結果を出力します" >&2
    terminate_review_process "$review_pid"
    break
  fi

  echo "[codex-review] 待機中 ${elapsed}s / ${MAX_WAIT_SECONDS}s" >&2
  remaining=$((MAX_WAIT_SECONDS - elapsed))
  sleep_for="$poll_interval"
  if (( remaining < sleep_for )); then
    sleep_for="$remaining"
  fi
  if (( sleep_for > 0 )); then
    sleep "$sleep_for"
  fi
done

if ! wait "$review_pid" 2>/dev/null; then
  review_exit=$?
fi

if (( timed_out == 0 && review_exit != 0 )); then
  cat "$TMP_OUT"
  exit "$review_exit"
fi

sid="$(
  awk '
    {
      line = $0
      sub(/\r$/, "", line)
      if (match(line, /session id:[[:space:]]*[^[:space:]]+/)) {
        sid = substr(line, RSTART, RLENGTH)
        sub(/^session id:[[:space:]]*/, "", sid)
        print sid
        exit
      }
    }
  ' "$TMP_OUT"
)"

if [[ -z "$sid" ]]; then
  cat "$TMP_OUT"
  if (( timed_out == 1 )); then
    exit 124
  fi
  exit 0
fi

LOG_ROOT="${LOG_ROOT:-$HOME/.codex/sessions}"
log_path="$(find "$LOG_ROOT" -type f -name "*${sid}.jsonl" 2>/dev/null | sort | tail -n 1)"

if [[ -z "$log_path" || ! -f "$log_path" ]]; then
  cat "$TMP_OUT"
  if (( timed_out == 1 )); then
    exit 124
  fi
  exit 0
fi

python3 - "$log_path" "$TMP_OUT" <<'PY'
import json
import sys

log_path = sys.argv[1]
raw_path = sys.argv[2]
last_text = ""

try:
    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
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
else:
    with open(raw_path, "r", encoding="utf-8", errors="ignore") as f:
        print(f.read(), end="")
PY

if (( timed_out == 1 )); then
  exit 124
fi
