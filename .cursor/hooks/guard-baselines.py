#!/usr/bin/env python
"""beforeShellExecution: block local Playwright snapshot updates."""

from __future__ import annotations

import json
import re
import sys

DENY_USER = (
    "Visual screenshot baselines are updated only on Linux in CI via the "
    "visual-baselines workflow, then merged through a reviewed pull request."
)
DENY_AGENT = (
    "Do not run Playwright with --update-snapshots or -u locally. "
    "Regenerate baselines with the GitHub Actions workflow "
    "'.github/workflows/visual-baselines.yml' (workflow_dispatch) and open a PR "
    "from the branch it creates."
)

UPDATE_SNAPSHOTS_RE = re.compile(r"(?:^|\s)--update-snapshots(?:\s|=|$)")
SHORT_UPDATE_RE = re.compile(r"(?:^|\s)-u(?:\s|$)")

PLAYWRIGHT_INVOCATION_RE = re.compile(
    r"playwright\b|npm\s+run\s+test:pw\b",
    re.IGNORECASE,
)


def emit(payload: dict, code: int = 0) -> None:
    print(json.dumps(payload))
    raise SystemExit(code)


def deny() -> None:
    emit(
        {
            "permission": "deny",
            "user_message": DENY_USER,
            "agent_message": DENY_AGENT,
        },
        2,
    )


def allow() -> None:
    emit({"permission": "allow"})


def read_payload() -> dict:
    raw = sys.stdin.buffer.read().decode("utf-8-sig")
    if not raw.strip():
        print("guard-baselines: empty stdin", file=sys.stderr)
        raise SystemExit(1)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"guard-baselines: invalid JSON — {exc}", file=sys.stderr)
        raise SystemExit(1)


def main() -> None:
    payload = read_payload()
    command = payload.get("command")
    if not isinstance(command, str) or not command.strip():
        allow()

    is_playwright = bool(
        PLAYWRIGHT_INVOCATION_RE.search(command)
        or re.search(r"\bplaywright\b", command, re.IGNORECASE)
    )
    if not is_playwright:
        allow()

    if UPDATE_SNAPSHOTS_RE.search(command) or SHORT_UPDATE_RE.search(command):
        deny()

    allow()


if __name__ == "__main__":
    main()
