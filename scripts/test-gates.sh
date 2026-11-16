#!/usr/bin/env bash
# Offline pipeline gate checks — no API keys, no GitHub network.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0
AGENT_GUARD="$ROOT/scripts/agent-guard.sh"
PR_TRIAGE="$ROOT/.github/workflows/pr-triage.yml"

pass() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; FAIL=1; }

run_hook() {
  local hook_py="$1"
  local command="$2"
  python "$hook_py" <<<"$(printf '%s' "{\"command\":$(python -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$command")}")" 2>/dev/null \
    | python -c 'import json,sys; print(json.load(sys.stdin).get("permission",""))'
}

hook_expect() {
  local label="$1"
  local hook_py="$2"
  local command="$3"
  local want="$4"
  local got
  got="$(run_hook "$hook_py" "$command" || true)"
  if [ "$got" = "$want" ]; then
    pass "$label"
  else
    fail "$label (got ${got:-empty}, want $want)"
  fi
}

# --- agent-guard (throwaway worktree; never touches developer checkout) ---
WORKTREE=""
cleanup_worktree() {
  if [ -n "$WORKTREE" ] && [ -d "$WORKTREE" ]; then
    git worktree remove --force "$WORKTREE" 2>/dev/null || rm -rf "$WORKTREE"
  fi
}
trap cleanup_worktree EXIT

make_patch() {
  local wt="$1"
  shift
  (
    cd "$wt" || exit 1
    local rel
    for rel in "$@"; do
      mkdir -p "$(dirname "$rel")"
      printf '%s\n' "gate-test" >"$rel"
      git add "$rel"
    done
    git diff --cached --binary
  )
}

guard_case() {
  local label="$1"
  local expect_ok="$2"
  shift 2
  local patterns=()
  local files=()
  while [ "$#" -gt 0 ]; do
    if [ "$1" = "--" ]; then
      shift
      files=("$@")
      break
    fi
    patterns+=("$1")
    shift
  done

  local patch_file rc
  WORKTREE="$(mktemp -d)"
  git worktree add --detach "$WORKTREE" HEAD >/dev/null 2>&1
  patch_file="$(mktemp)"
  make_patch "$WORKTREE" "${files[@]}" >"$patch_file"

  set +e
  bash "$AGENT_GUARD" "$patch_file" "${patterns[@]}" >/dev/null 2>&1
  rc=$?
  set -e
  rm -f "$patch_file"
  git worktree remove --force "$WORKTREE" 2>/dev/null
  WORKTREE=""

  if [ "$expect_ok" = "allow" ] && [ "$rc" -eq 0 ]; then
    pass "$label"
  elif [ "$expect_ok" = "block" ] && [ "$rc" -ne 0 ]; then
    pass "$label"
  else
    fail "$label (exit $rc, expected $expect_ok)"
  fi
}

guard_case "agent-guard: plan-only patch allowed" allow \
  'docs/test-plans/*' -- "docs/test-plans/gate-plan-only.md"

guard_case "agent-guard: web/src change blocked" block \
  'docs/test-plans/*' -- "docs/test-plans/x.md" "web/src/components/GateTest.tsx"

guard_case "agent-guard: workflow change blocked" block \
  'docs/test-plans/*' -- "docs/test-plans/x.md" ".github/workflows/evil.yml"

guard_case "agent-guard: snapshot baseline blocked" block \
  'tests/*' 'web/cypress/*' 'docs/test-plans/*' 'FINDINGS.md' -- \
  "tests/visual/catalog.spec.ts-snapshots/gate-linux.png"

guard_case "agent-guard: agent-guard.sh blocked despite scripts allowlist" block \
  'scripts/*' 'docs/test-plans/*' -- "scripts/agent-guard.sh"

guard_case "agent-guard: tests and FINDINGS allowed" allow \
  'tests/*' 'web/cypress/*' 'docs/test-plans/*' 'FINDINGS.md' -- \
  "tests/api/gate.spec.ts" "FINDINGS.md"

# --- hooks (P77 baselines, P81 approvals) ---
BASELINES_PY="$ROOT/.cursor/hooks/guard-baselines.py"
APPROVALS_PY="$ROOT/.cursor/hooks/guard-approvals.py"

hook_expect "hook guard-baselines (P77): --update-snapshots denied" \
  "$BASELINES_PY" "npx playwright test --update-snapshots" deny
hook_expect "hook guard-baselines (P77): -u denied" \
  "$BASELINES_PY" "npx playwright test -u" deny
hook_expect "hook guard-baselines (P77): npm run test:pw allowed" \
  "$BASELINES_PY" "npm run test:pw" allow

hook_expect "hook guard-approvals (P81): gh pr edit --add-label denied" \
  "$APPROVALS_PY" "gh pr edit 7 --add-label triaged" deny
hook_expect "hook guard-approvals (P81): gh pr merge denied" \
  "$APPROVALS_PY" "gh pr merge 7" deny
hook_expect "hook guard-approvals (P81): gh pr review --approve denied" \
  "$APPROVALS_PY" "gh pr review 7 --approve" deny
hook_expect "hook guard-approvals (P81): printenv denied" \
  "$APPROVALS_PY" "printenv" deny
hook_expect "hook guard-approvals (P81): gh pr view allowed" \
  "$APPROVALS_PY" "gh pr view 7" allow
hook_expect "hook guard-approvals (P81): git diff allowed" \
  "$APPROVALS_PY" "git diff origin/init...HEAD" allow

# --- workflows (grep/awk only) ---
workflows_no_prtarget() {
  local wf bad=0 f
  for f in "$ROOT"/.github/workflows/*.yml; do
    [ -f "$f" ] || continue
    if grep -vE '^\s*#' "$f" | grep -q 'pull_request_target'; then
      bad=1
    fi
  done
  if [ "$bad" -eq 0 ]; then
    pass "workflow: no pull_request_target trigger"
  else
    fail "workflow: no pull_request_target trigger"
  fi
}
workflows_no_prtarget

pr_triage_job_timeouts() {
  local missing
  missing="$(
    awk '
      /^jobs:/ { injobs = 1; next }
      !injobs { next }
      /^  [a-zA-Z0-9_.-]+:$/ {
        if (job != "" && !timeout) print job
        job = $1
        sub(/:$/, "", job)
        timeout = 0
        next
      }
      job != "" && /^    timeout-minutes:/ { timeout = 1 }
      END { if (job != "" && !timeout) print job }
    ' "$PR_TRIAGE"
  )"
  if [ -z "$missing" ]; then
    pass "workflow: pr-triage jobs have timeout-minutes"
  else
    fail "workflow: pr-triage jobs have timeout-minutes (missing: $missing)"
  fi
}
pr_triage_job_timeouts

agent_job_token_free() {
  local jobs bad=0
  jobs="$(
    awk '
      /^jobs:/ { injobs = 1; next }
      !injobs { next }
      /^  [a-zA-Z0-9_.-]+:$/ {
        if (job != "" && agent && (gh || ght)) print job
        job = $1
        sub(/:$/, "", job)
        agent = 0
        gh = 0
        ght = 0
        next
      }
      job != "" {
        if (/run-agent\.sh/) agent = 1
        if (/GH_TOKEN:/) gh = 1
        if (/GITHUB_TOKEN:/) ght = 1
      }
      END { if (job != "" && agent && (gh || ght)) print job }
    ' "$PR_TRIAGE"
  )"
  if [ -z "$jobs" ]; then
    pass "workflow: agent jobs lack GH_TOKEN and GITHUB_TOKEN"
  else
    fail "workflow: agent jobs lack GH_TOKEN and GITHUB_TOKEN (jobs: $jobs)"
  fi
}
agent_job_token_free

agent_checkout_no_persist() {
  local jobs bad_job="" j
  jobs="$(
    awk '
      /^jobs:/ { injobs = 1; next }
      !injobs { next }
      /^  [a-zA-Z0-9_.-]+:$/ {
        if (job != "" && agent && !persist) print job
        job = $1
        sub(/:$/, "", job)
        agent = 0
        persist = 0
        next
      }
      job != "" {
        if (/run-agent\.sh/) agent = 1
        if (/persist-credentials:[[:space:]]*false/) persist = 1
      }
      END { if (job != "" && agent && !persist) print job }
    ' "$PR_TRIAGE"
  )"
  if [ -z "$jobs" ]; then
    pass "workflow: agent job checkout persist-credentials false"
  else
    fail "workflow: agent job checkout persist-credentials false (jobs: $jobs)"
  fi
}
agent_checkout_no_persist

tests_job_human_label() {
  local ok=0
  if awk '
      /^jobs:/ { injobs = 1; next }
      !injobs { next }
      /^  tests:$/ { intests = 1; next }
      intests && /^  [a-zA-Z0-9_.-]+:$/ { intests = 0 }
      intests && /plan-approved/ { p = 1 }
      intests && /github\.event\.sender\.type == .User./ { u = 1 }
      END { exit !(p && u) }
    ' "$PR_TRIAGE"; then
    pass "workflow: tests job requires User sender for plan-approved"
  else
    fail "workflow: tests job requires User sender for plan-approved"
  fi
}
tests_job_human_label

plan_budget_present() {
  if grep -q 'Skipping plan (budget)' "$PR_TRIAGE" \
    && grep -q "web/src/" "$PR_TRIAGE"; then
    pass "workflow: plan job budget skip present"
  else
    fail "workflow: plan job budget skip present"
  fi
}
plan_budget_present

exit "$FAIL"