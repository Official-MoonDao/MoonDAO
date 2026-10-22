#!/usr/bin/env python3
"""Enable auto-merge on an approved pull request once pr-green is required.

GitHub then merges only after that check is green. The Actions token cannot
read branch protection, so the repository variable PR_GREEN_REQUIRED must be
set to true in the same step that pr-green is marked required. Until then,
arming auto-merge would merge on approval alone, and this script does nothing.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys


def decide(pull_request: dict, pr_green_required: bool) -> str:
    if pull_request.get("state") != "OPEN":
        return "skip: pull request is not open"
    if pull_request.get("isDraft"):
        return "skip: draft pull request"
    if pull_request.get("baseRefName") != "main":
        return "skip: base branch is not main"
    if pull_request.get("reviewDecision") != "APPROVED":
        return "skip: pull request is not approved"
    if not pr_green_required:
        return "skip: PR_GREEN_REQUIRED is not true, so pr-green is not enforced yet"
    if pull_request.get("autoMergeRequest"):
        return "skip: auto-merge is already enabled"
    return "merge"


def gh_json(args: list[str]) -> tuple[int, str, str]:
    proc = subprocess.run(
        ["gh", *args],
        text=True,
        capture_output=True,
        check=False,
    )
    return proc.returncode, proc.stdout, proc.stderr


def pull_request(repo: str, number: str) -> dict:
    code, stdout, stderr = gh_json(
        [
            "pr",
            "view",
            number,
            "--repo",
            repo,
            "--json",
            "autoMergeRequest,baseRefName,isDraft,reviewDecision,state",
        ]
    )
    if code != 0:
        raise RuntimeError(stderr.strip() or stdout.strip() or "failed to read pull request")
    return json.loads(stdout)


def enable_auto_merge(repo: str, number: str) -> int:
    proc = subprocess.run(
        ["gh", "pr", "merge", number, "--repo", repo, "--auto", "--merge"],
        text=True,
        capture_output=True,
        check=False,
    )
    sys.stdout.write(proc.stdout)
    sys.stderr.write(proc.stderr)
    if proc.returncode == 0:
        return 0
    blob = f"{proc.stdout}\n{proc.stderr}".lower()
    if "already" in blob and ("auto-merge" in blob or "merged" in blob):
        print("Auto-merge is already enabled.")
        return 0
    return proc.returncode


def self_test() -> None:
    approved = {
        "state": "OPEN",
        "isDraft": False,
        "baseRefName": "main",
        "reviewDecision": "APPROVED",
        "autoMergeRequest": None,
    }
    assert decide(approved, True) == "merge"
    assert decide(approved, False).startswith("skip:")
    assert decide({**approved, "isDraft": True}, True).startswith("skip:")
    assert decide({**approved, "baseRefName": "develop"}, True).startswith("skip:")
    assert decide({**approved, "reviewDecision": "REVIEW_REQUIRED"}, True).startswith("skip:")
    assert decide({**approved, "state": "MERGED"}, True).startswith("skip:")
    assert decide({**approved, "autoMergeRequest": {"enabledAt": "t"}}, True).startswith("skip:")
    print("arm-auto-merge self-test passed")


def main(argv: list[str]) -> int:
    command = argv[1] if len(argv) > 1 else "run"
    if command == "self-test":
        self_test()
        return 0
    if command != "run":
        print(f"Unknown command {command}", file=sys.stderr)
        return 2
    repo = os.environ["REPO"]
    number = os.environ["PR_NUMBER"]
    action = decide(pull_request(repo, number), os.environ.get("PR_GREEN_REQUIRED") == "true")
    print(action)
    if action != "merge":
        return 0
    return enable_auto_merge(repo, number)


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except (RuntimeError, KeyError) as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)
