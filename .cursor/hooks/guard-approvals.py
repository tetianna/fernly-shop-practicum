#!/usr/bin/env python
"""beforeShellExecution: block merges, approvals, label edits, and secret reads."""

from __future__ import annotations

import json
import re
import sys

DENY_USER = (
    "Only a person may merge pull requests, approve reviews, add labels, "
    "or read CURSOR_API_KEY / GH_TOKEN / GITHUB_TOKEN."
)
DENY_AGENT = (
    "This command is blocked. Merges, PR approvals, label changes, and "
    "reading CURSOR_API_KEY, GH_TOKEN, or GITHUB_TOKEN are for a human only."
)

SECRET_NAMES = r"(?:CURSOR_API_KEY|GH_TOKEN|GITHUB_TOKEN)"


def gh_pr_review_approve(command: str) -> bool:
    if not re.search(r"\bgh\s+pr\s+review\b", command, re.I):
        return False
    return bool(re.search(r"(?:--approve\b|-\s*a(?:\s|$))", command, re.I))


DENY_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bgh\s+pr\s+merge\b", re.I), "gh pr merge"),
    (
        re.compile(
            r"\bgh\s+pr\s+edit\b.*?(?:--add-label\b|--add-labels\b)", re.I | re.S
        ),
        "gh pr edit --add-label",
    ),
    (
        re.compile(
            r"\bgh\s+issue\s+edit\b.*?(?:--add-label\b|--add-labels\b)", re.I | re.S
        ),
        "gh issue edit --add-label",
    ),
    (re.compile(r"\bgh\s+label\s+(?:create|edit|clone)\b", re.I), "gh label"),
    (
        re.compile(
            r"\bgh\s+api\b.*?(?:/labels\b|-f\s+labels=|-F\s+labels=)",
            re.I | re.S,
        ),
        "gh api …/labels",
    ),
    (
        re.compile(
            r"\bgh\s+api\b.*?(?:/merge\b|/reviews\b|event\s*=\s*APPROVE)",
            re.I | re.S,
        ),
        "gh api merge/review",
    ),
    (re.compile(r"\bprintenv\b", re.I), "printenv"),
    (re.compile(r"^\s*env\s*$", re.I), "env"),
    (
        re.compile(
            rf"(?:\${SECRET_NAMES}|%({SECRET_NAMES})%)\b",
            re.I,
        ),
        "secret variable reference",
    ),
    (
        re.compile(
            rf"\b(?:echo|printenv|type|cat)\b.*\b{SECRET_NAMES}\b",
            re.I | re.S,
        ),
        "reading secret env vars",
    ),
    (
        re.compile(rf"\bprintenv\s+{SECRET_NAMES}\b", re.I),
        "printenv secret",
    ),
    (
        re.compile(rf"\benv\b.*\b{SECRET_NAMES}\b", re.I),
        "env secret",
    ),
]


def emit(payload: dict, code: int = 0) -> None:
    print(json.dumps(payload))
    raise SystemExit(code)


def deny(reason: str) -> None:
    emit(
        {
            "permission": "deny",
            "user_message": DENY_USER,
            "agent_message": f"{DENY_AGENT} (matched: {reason})",
        },
        2,
    )


def allow() -> None:
    emit({"permission": "allow"})


def read_payload() -> dict:
    raw = sys.stdin.buffer.read().decode("utf-8-sig")
    if not raw.strip():
        print("guard-approvals: empty stdin", file=sys.stderr)
        raise SystemExit(1)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"guard-approvals: invalid JSON — {exc}", file=sys.stderr)
        raise SystemExit(1)


def main() -> None:
    payload = read_payload()
    command = payload.get("command")
    if not isinstance(command, str) or not command.strip():
        allow()

    if gh_pr_review_approve(command):
        deny("gh pr review --approve")

    for pattern, label in DENY_RULES:
        if pattern.search(command):
            deny(label)

    allow()


if __name__ == "__main__":
    main()