#!/usr/bin/env python3
"""Fail when a pull request adds a denylisted name to the public MoonDAO repo.

The denylist is read from the OPS_DENYLIST environment variable, one term per
line, filled from a repository secret. Output names only where a match was
found (file and line, or "title", "body", "commit <sha>"), never the term or
its position in the list, so a failing run does not reveal the list.

In CI (pull_request_target), the script reads the PR through the GitHub API
and never checks out or runs PR code:

    GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo PR_NUMBER=123 python3 check_denylist.py

Locally, against a unified diff and optional extra text files:

    OPS_DENYLIST="$(cat terms.txt)" python3 check_denylist.py --diff change.diff --text title.txt
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request

API = "https://api.github.com"


def load_terms() -> list[re.Pattern]:
    raw = os.environ.get("OPS_DENYLIST", "")
    terms = [t.strip() for t in raw.splitlines() if t.strip() and not t.strip().startswith("#")]
    return [re.compile(r"(?<!\w)" + re.escape(t) + r"(?!\w)", re.I) for t in terms]


def hits(patterns: list[re.Pattern], text: str) -> bool:
    return any(p.search(text) for p in patterns)


def added_lines(diff: str):
    """Yield (path, new_line_number, text) for every added line in a unified diff."""
    path, line = None, 0
    for raw in diff.splitlines():
        if raw.startswith("+++ "):
            target = raw[4:].strip()
            path = None if target == "/dev/null" else re.sub(r"^b/", "", target)
            continue
        if raw.startswith("@@"):
            m = re.match(r"@@ -\d+(?:,\d+)? \+(\d+)", raw)
            line = int(m.group(1)) if m else 0
            continue
        if path is None or raw.startswith("--- "):
            continue
        if raw.startswith("+"):
            yield path, line, raw[1:]
            line += 1
        elif raw.startswith(" "):
            line += 1


def patch_lines(path: str, patch: str):
    return added_lines(f"+++ b/{path}\n{patch}")


def gh(url: str, token: str, accept: str = "application/vnd.github+json"):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "Accept": accept})
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read()
    return body if accept.endswith("raw") else json.loads(body)


def paged(url: str, token: str):
    page = 1
    while True:
        batch = gh(f"{url}?per_page=100&page={page}", token)
        if not batch:
            return
        yield from batch
        if len(batch) < 100:
            return
        page += 1


def scan_pr(patterns, token: str, repo: str, number: int) -> list[str]:
    findings = []
    pr = gh(f"{API}/repos/{repo}/pulls/{number}", token)
    if hits(patterns, pr.get("title") or ""):
        findings.append("pull request title")
    if hits(patterns, pr.get("body") or ""):
        findings.append("pull request body")
    if hits(patterns, pr.get("head", {}).get("ref") or ""):
        findings.append("branch name")
    for commit in paged(f"{API}/repos/{repo}/pulls/{number}/commits", token):
        if hits(patterns, commit["commit"]["message"]):
            findings.append(f"commit {commit['sha'][:7]} message")
    for f in paged(f"{API}/repos/{repo}/pulls/{number}/files", token):
        name = f["filename"]
        # A deletion removes the path. Skip before the name check so a cleanup
        # pull request can delete a denylisted filename.
        if f.get("status") == "removed":
            continue
        if hits(patterns, name):
            findings.append(f"{name} (file name)")
        patch = f.get("patch")
        if patch is not None:
            for path, line, text in patch_lines(name, patch):
                if hits(patterns, text):
                    findings.append(f"{path}:{line}")
            continue
        # Pure renames and mode-only changes also omit `patch`, and they add
        # no lines. Do not scan the existing blob.
        if f.get("additions", 0) == 0 and f.get("status") in ("renamed", "changed"):
            continue
        # GitHub omits the patch for large or binary files. Scan the whole new
        # version instead, read as a blob through the API, not checked out.
        contents_url = f.get("contents_url")
        if not contents_url:
            findings.append(f"{name} (could not be inspected)")
            continue
        blob = gh(contents_url, token, accept="application/vnd.github.raw")
        text = blob.decode("utf-8", errors="ignore")
        for i, row in enumerate(text.splitlines(), start=1):
            if hits(patterns, row):
                findings.append(f"{name}:{i}")
    return findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--diff", help="scan a unified diff file instead of a pull request")
    parser.add_argument("--text", action="append", default=[], help="extra text file to scan, such as a title or body")
    args = parser.parse_args()

    patterns = load_terms()
    if not patterns:
        print("OPS_DENYLIST is empty or unset; failing closed.", file=sys.stderr)
        return 2

    if args.diff:
        findings = []
        with open(args.diff) as handle:
            for path, line, text in added_lines(handle.read()):
                if hits(patterns, text):
                    findings.append(f"{path}:{line}")
        for extra in args.text:
            with open(extra) as handle:
                if hits(patterns, handle.read()):
                    findings.append(extra)
    else:
        token = os.environ["GITHUB_TOKEN"]
        findings = scan_pr(patterns, token, os.environ["GITHUB_REPOSITORY"], int(os.environ["PR_NUMBER"]))

    if findings:
        for where in findings:
            print(f"::error::Denylisted term found in {where}")
        print(f"{len(findings)} location(s) contain a denylisted term. Remove it and push again. "
              "Ask an EB lead if you need to know which term matched.", file=sys.stderr)
        return 1
    print("ok: no denylisted terms in this pull request")
    return 0


if __name__ == "__main__":
    sys.exit(main())
