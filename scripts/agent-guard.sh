#!/usr/bin/env bash
# agent-guard.sh <patch> <allowed pattern>...
# Bash 3.2 compatible.
set -e

PATCH="${1:?patch file required}"
shift

if [ ! -s "$PATCH" ]; then
  exit 0
fi

is_forbidden() {
  local f="$1"
  case "$f" in
    web/src/* | api/src/* | .github/* | .cursor/* | scripts/*) return 0 ;;
    package.json | */package.json) return 0 ;;
    package-lock.json | */package-lock.json) return 0 ;;
    playwright.config.ts | */playwright.config.ts) return 0 ;;
    web/cypress.config.ts) return 0 ;;
    a11y-baseline.json | */a11y-baseline.json) return 0 ;;
    *-snapshots/*) return 0 ;;
    web/cypress/screenshots/*) return 0 ;;
    web/cypress/results/*) return 0 ;;
    .env | .env.* | */.env | */.env.*) return 0 ;;
  esac
  return 1
}

matches_allowed() {
  local f="$1"
  local pat
  for pat in "$@"; do
    case "$f" in
      $pat) return 0 ;;
    esac
  done
  return 1
}

if [ "$#" -eq 0 ]; then
  echo "agent-guard: at least one allowed pattern is required" >&2
  exit 1
fi

violations=""
while IFS=$'\t' read -r _add _del path _rest; do
  [ -z "$path" ] && continue
  reason=""
  if is_forbidden "$path"; then
    reason="person-only path"
  elif ! matches_allowed "$path" "$@"; then
    reason="outside allowed patterns"
  fi
  if [ -n "$reason" ]; then
    violations="${violations}  - ${path} (${reason})
"
  fi
done <<EOF
$(git apply --numstat "$PATCH" 2>/dev/null || true)
EOF

if [ -n "$violations" ]; then
  echo "agent-guard: patch touches files that must not be changed by CI agent:" >&2
  printf '%b' "$violations" >&2
  exit 1
fi

exit 0