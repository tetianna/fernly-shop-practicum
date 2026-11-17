#!/usr/bin/env bash
# run-agent.sh <prompt-file> <result-file> <trail-file>
# Bash 3.2 compatible.
set -e

PROMPT_FILE="${1:?prompt file required}"
RESULT_FILE="${2:?result file required}"
TRAIL_FILE="${3:?trail file required}"

if ! command -v jq >/dev/null 2>&1; then
  echo "run-agent: jq is required" >&2
  exit 1
fi

if ! command -v agent >/dev/null 2>&1; then
  echo "run-agent: cursor agent CLI (agent) is required" >&2
  exit 1
fi

FIFO="$(mktemp -u)"
mkfifo "$FIFO"
trap 'rm -f "$FIFO"' EXIT

: >"$TRAIL_FILE"
: >"$RESULT_FILE"

AGENT_ERR="$(mktemp)"
trap 'rm -f "$FIFO" "$AGENT_ERR"' EXIT

agent -p --force --trust --output-format stream-json "$(cat "$PROMPT_FILE")" >"$FIFO" 2>"$AGENT_ERR" &
AGENT_PID=$!
RESULT_BYTES=0
RESULT_STABLE_SINCE=""

idle_agent_watchdog() {
  while kill -0 "$AGENT_PID" 2>/dev/null; do
    sleep 30
    if ! kill -0 "$AGENT_PID" 2>/dev/null; then
      break
    fi
    if [ ! -s "$RESULT_FILE" ]; then
      continue
    fi
    now="$(date +%s)"
    bytes="$(wc -c <"$RESULT_FILE" | tr -d ' ')"
    if [ "$bytes" != "$RESULT_BYTES" ]; then
      RESULT_BYTES="$bytes"
      RESULT_STABLE_SINCE="$now"
      continue
    fi
    if [ -z "$RESULT_STABLE_SINCE" ]; then
      RESULT_STABLE_SINCE="$now"
      continue
    fi
    idle="$((now - RESULT_STABLE_SINCE))"
    if [ "$idle" -ge 180 ]; then
      echo "run-agent: result unchanged for ${idle}s; stopping agent (likely orphan servers)" >&2
      kill "$AGENT_PID" 2>/dev/null || true
      sleep 3
      kill -9 "$AGENT_PID" 2>/dev/null || true
      break
    fi
  done
}

idle_agent_watchdog &
WATCHDOG_PID=$!
trap 'kill "$WATCHDOG_PID" 2>/dev/null || true' EXIT

log_tool_line() {
  local line="$1"
  echo "$line" | jq -r '
    if .tool_call.function then
      "tool: " + .tool_call.function.name
    else
      (.tool_call | to_entries[0]) as $e |
      if $e then
        "tool: " + ($e.key | sub("ToolCall$"; "")) + " " + ( ($e.value.args // {}) | tostring)
      else
        "tool: (unknown)"
      end
    end
  ' 2>/dev/null || echo "tool: (unknown)"
}

while IFS= read -r line; do
  [ -z "$line" ] && continue
  printf '%s\n' "$line" >>"$TRAIL_FILE"
  if echo "$line" | jq -e '.type == "tool_call" and .subtype == "started"' >/dev/null 2>&1; then
    log_tool_line "$line"
  fi
  if echo "$line" | jq -e '.type == "result"' >/dev/null 2>&1; then
    result_text="$(echo "$line" | jq -r '.result // empty' 2>/dev/null || true)"
    if [ -n "$result_text" ]; then
      printf '%s' "$result_text" >"$RESULT_FILE"
    fi
  fi
done <"$FIFO"

kill "$WATCHDOG_PID" 2>/dev/null || true
wait "$WATCHDOG_PID" 2>/dev/null || true

wait "$AGENT_PID" || {
  if [ -s "$AGENT_ERR" ]; then
    cat "$AGENT_ERR" >&2
  fi
  exit 1
}

if [ ! -s "$RESULT_FILE" ]; then
  jq -sr 'map(select(.type == "assistant")) | last | .message.content[]? | select(.type == "text") | .text // empty' "$TRAIL_FILE" 2>/dev/null >"$RESULT_FILE" || true
fi

if [ ! -s "$RESULT_FILE" ]; then
  jq -sr 'map(select(.type == "result")) | last | .result // empty' "$TRAIL_FILE" 2>/dev/null >"$RESULT_FILE" || true
fi