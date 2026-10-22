#!/usr/bin/env python3
"""Wait until the pull request workflows that match the diff have finished.

Path filters skip a workflow entirely, so GitHub never reports its check.
Branch protection can only require a check that exists on every pull request.
This job is that check: it passes when every matching workflow passed, and
fails when one failed or never started.

Closing and reopening a pull request reuses the head SHA. A run created for
an earlier delivery of that SHA does not count.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"
GATE_WORKFLOW = ".github/workflows/required-checks.yml"
EXCLUDED = {
    GATE_WORKFLOW,
    # Bookkeeping, not a test. A failure here must not block pr-green.
    ".github/workflows/auto-merge-on-approval.yml",
}
DEFAULT_TYPES = ("opened", "synchronize", "reopened")
APPEAR_TIMEOUT_SECONDS = 20 * 60
# One pull_request delivery creates its workflow runs within seconds of the
# event. Anything older than this before pull_request.updated_at is a previous
# delivery of the same SHA (reopened, or an earlier pull request).
SAME_DELIVERY_SKEW_SECONDS = 60
POLL_SECONDS = 30
OK_CONCLUSIONS = {"success"}
FAIL_CONCLUSIONS = {
    "failure",
    "timed_out",
    "cancelled",
    "action_required",
    "stale",
    "startup_failure",
    "skipped",
    "neutral",
}


@dataclass(frozen=True)
class Trigger:
    path: str
    name: str
    paths: tuple[str, ...] | None
    paths_ignore: tuple[str, ...]
    branches: tuple[str, ...] | None
    branches_ignore: tuple[str, ...]
    types: tuple[str, ...] | None


@dataclass(frozen=True)
class Run:
    id: int
    path: str
    name: str
    status: str
    conclusion: str | None
    html_url: str
    created_at: float


class WorkflowParseError(Exception):
    pass


def unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def strip_comment(text: str) -> str:
    out: list[str] = []
    quote = None
    for char in text:
        if quote:
            out.append(char)
            if char == quote:
                quote = None
            continue
        if char in {'"', "'"}:
            quote = char
            out.append(char)
            continue
        if char == "#":
            break
        out.append(char)
    return "".join(out).rstrip()


def tokenize(text: str) -> list[tuple[int, str]]:
    tokens: list[tuple[int, str]] = []
    for raw in text.splitlines():
        if "\t" in raw[: len(raw) - len(raw.lstrip(" \t"))]:
            raise WorkflowParseError("tab indentation is not supported")
        stripped = strip_comment(raw).strip()
        if not stripped or stripped == "---":
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        tokens.append((indent, stripped))
    return tokens


def split_key(text: str) -> tuple[str, str]:
    key, sep, rest = text.partition(":")
    if not sep:
        raise WorkflowParseError(f"expected key: value, got {text!r}")
    return key.strip(), rest.strip()


def parse_flow_list(text: str) -> list[str]:
    inner = text.strip()[1:-1].strip()
    if not inner:
        return []
    parts: list[str] = []
    buf: list[str] = []
    quote = None
    for char in inner:
        if quote:
            if char == quote:
                quote = None
            else:
                buf.append(char)
            continue
        if char in {'"', "'"}:
            quote = char
            continue
        if char == ",":
            parts.append("".join(buf).strip())
            buf = []
            continue
        buf.append(char)
    if buf:
        parts.append("".join(buf).strip())
    return [part for part in parts if part]


def parse_list(tokens: list[tuple[int, str]], index: int, indent: int):
    items: list[str] = []
    while index < len(tokens):
        token_indent, text = tokens[index]
        if token_indent != indent or not text.startswith("- "):
            break
        item = text[2:].strip()
        if not item:
            raise WorkflowParseError("empty list item in a workflow trigger")
        items.append(unquote(item))
        index += 1
    return items, index


def parse_value(tokens: list[tuple[int, str]], index: int, parent_indent: int, rest: str):
    if rest[:1] in {"|", ">"}:
        raise WorkflowParseError("block scalars are not supported in workflow triggers")
    if rest.startswith("[") and rest.endswith("]"):
        return parse_flow_list(rest), index
    if rest:
        return unquote(rest), index
    if index >= len(tokens) or tokens[index][0] <= parent_indent:
        return None, index
    child_indent, child_text = tokens[index]
    if child_text.startswith("- "):
        return parse_list(tokens, index, child_indent)
    return parse_map(tokens, index, child_indent)


def parse_map(tokens: list[tuple[int, str]], index: int, indent: int):
    mapping: dict = {}
    while index < len(tokens):
        token_indent, text = tokens[index]
        if token_indent < indent:
            break
        if text.startswith("- "):
            break
        if token_indent != indent:
            raise WorkflowParseError(
                f"unexpected indent {token_indent}, expected {indent}: {text}"
            )
        key, rest = split_key(text)
        index += 1
        value, index = parse_value(tokens, index, token_indent, rest)
        mapping[key] = value
    return mapping, index


def load_on_block(text: str):
    tokens = tokenize(text)
    name = None
    on_value = None
    index = 0
    while index < len(tokens):
        indent, text = tokens[index]
        if indent != 0:
            index += 1
            continue
        key, rest = split_key(text)
        if key == "name" and rest:
            name = unquote(rest)
            index += 1
            continue
        if key == "on":
            on_value, index = parse_value(tokens, index + 1, 0, rest)
            continue
        index += 1
    return name, on_value


def as_tuple(value) -> tuple[str, ...] | None:
    if value is None:
        return None
    if isinstance(value, list):
        if not all(isinstance(item, str) for item in value):
            raise WorkflowParseError(f"expected a list of strings, got {value!r}")
        return tuple(value)
    raise WorkflowParseError(f"expected a list of strings, got {value!r}")


def trigger_from_file(path: Path) -> Trigger | None:
    name, on_value = load_on_block(path.read_text())
    if isinstance(on_value, str):
        events = {on_value: None}
    elif isinstance(on_value, list):
        events = {str(item): None for item in on_value}
    elif isinstance(on_value, dict):
        events = on_value
    elif on_value is None:
        return None
    else:
        raise WorkflowParseError(f"{path}: unsupported on: block")
    if "pull_request" not in events:
        return None
    config = events["pull_request"] or {}
    if not isinstance(config, dict):
        raise WorkflowParseError(f"{path}: pull_request trigger must be a mapping")
    relative = path.relative_to(ROOT).as_posix()
    return Trigger(
        path=relative,
        name=name or path.name,
        paths=as_tuple(config.get("paths")),
        paths_ignore=as_tuple(config.get("paths-ignore")) or (),
        branches=as_tuple(config.get("branches")),
        branches_ignore=as_tuple(config.get("branches-ignore")) or (),
        types=as_tuple(config.get("types")),
    )


def load_triggers() -> list[Trigger]:
    triggers: list[Trigger] = []
    for path in sorted(WORKFLOWS.glob("*.yml")) + sorted(WORKFLOWS.glob("*.yaml")):
        try:
            trigger = trigger_from_file(path)
        except WorkflowParseError as exc:
            raise WorkflowParseError(f"{path}: {exc}") from exc
        if trigger is not None:
            triggers.append(trigger)
    return triggers


def compile_glob(pattern: str) -> re.Pattern[str]:
    if any(char in pattern for char in "[]+"):
        raise WorkflowParseError(f"unsupported glob metacharacter in {pattern!r}")
    regex: list[str] = ["^"]
    index = 0
    while index < len(pattern):
        if pattern.startswith("**", index):
            regex.append(".*")
            index += 2
            continue
        char = pattern[index]
        if char == "*":
            regex.append("[^/]*")
        elif char == "?":
            regex.append("[^/]")
        else:
            regex.append(re.escape(char))
        index += 1
    regex.append("$")
    return re.compile("".join(regex))


def glob_match(pattern: str, value: str) -> bool:
    return compile_glob(pattern).match(value) is not None


def file_matches(path: str, positives: tuple[str, ...], negatives: tuple[str, ...]) -> bool:
    if not any(glob_match(pattern, path) for pattern in positives):
        return False
    return not any(glob_match(pattern, path) for pattern in negatives)


def matches(trigger: Trigger, files: list[str], base_ref: str, action: str) -> bool:
    types = trigger.types or DEFAULT_TYPES
    if action not in types:
        return False
    if trigger.branches is not None and not any(
        glob_match(pattern, base_ref) for pattern in trigger.branches
    ):
        return False
    if any(glob_match(pattern, base_ref) for pattern in trigger.branches_ignore):
        return False
    if trigger.paths is None:
        if not files:
            return False
        if not trigger.paths_ignore:
            return True
        return any(
            not any(glob_match(pattern, path) for pattern in trigger.paths_ignore)
            for path in files
        )
    return any(file_matches(path, trigger.paths, trigger.paths_ignore) for path in files)


def expected_workflows(
    triggers: list[Trigger], files: list[str], base_ref: str, action: str
) -> list[Trigger]:
    return [
        trigger
        for trigger in triggers
        if trigger.path not in EXCLUDED and matches(trigger, files, base_ref, action)
    ]


def latest_by_path(runs: list[Run]) -> dict[str, Run]:
    latest: dict[str, Run] = {}
    for run in runs:
        current = latest.get(run.path)
        if current is None or run.id > current.id:
            latest[run.path] = run
    return latest


def parse_timestamp(value: str) -> float:
    text = value.strip()
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as exc:
        raise RuntimeError(f"invalid timestamp {value!r}") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()


def runs_for_event(runs: list[Run], event_at: float) -> list[Run]:
    cutoff = event_at - SAME_DELIVERY_SKEW_SECONDS
    return [run for run in runs if run.created_at >= cutoff]


def evaluate(
    expected: list[Trigger],
    runs: list[Run],
    *,
    elapsed: float,
    appear_timeout: float = APPEAR_TIMEOUT_SECONDS,
    event_at: float | None = None,
) -> tuple[str, str]:
    if not expected:
        return "ok", "No pull request workflows match the changed files."
    if event_at is not None:
        runs = runs_for_event(runs, event_at)
    latest = latest_by_path(runs)
    missing: list[Trigger] = []
    pending: list[Run] = []
    failed: list[Run] = []
    passed: list[Run] = []
    for trigger in expected:
        run = latest.get(trigger.path)
        if run is None:
            missing.append(trigger)
            continue
        if run.status != "completed":
            pending.append(run)
            continue
        if run.conclusion in OK_CONCLUSIONS:
            passed.append(run)
            continue
        failed.append(run)
    if failed:
        lines = ["Required workflows failed:"]
        for run in failed:
            lines.append(f"- {run.name} ({run.path}) concluded {run.conclusion}: {run.html_url}")
        return "fail", "\n".join(lines)
    if missing and elapsed >= appear_timeout:
        lines = ["These workflows match the diff but never started:"]
        for trigger in missing:
            lines.append(f"- {trigger.name} ({trigger.path})")
        return "fail", "\n".join(lines)
    if missing or pending:
        details = []
        for trigger in missing:
            details.append(f"{trigger.name} not started")
        for run in pending:
            details.append(f"{run.name} {run.status}")
        return "wait", "Waiting: " + ", ".join(details)
    lines = ["Required workflows passed:"]
    for run in passed:
        lines.append(f"- {run.name} ({run.path})")
    return "ok", "\n".join(lines)


def gh_json_lines(args: list[str]) -> list:
    last_error = ""
    for attempt in range(4):
        proc = subprocess.run(
            ["gh", *args],
            text=True,
            capture_output=True,
            check=False,
        )
        if proc.returncode == 0:
            rows = []
            for line in proc.stdout.splitlines():
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
            return rows
        last_error = proc.stderr.strip() or proc.stdout.strip()
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(last_error or "gh api failed")


def changed_files(repo: str, number: str) -> list[str]:
    rows = gh_json_lines(
        [
            "api",
            "--paginate",
            f"/repos/{repo}/pulls/{number}/files?per_page=100",
            "--jq",
            ".[] | {filename, previous_filename}",
        ]
    )
    if len(rows) >= 3000:
        raise RuntimeError("Pull request changes more than 3000 files; refusing to guess.")
    names: list[str] = []
    for row in rows:
        names.append(row["filename"])
        previous = row.get("previous_filename")
        if previous:
            names.append(previous)
    return names


def workflow_runs(repo: str, sha: str) -> list[Run]:
    rows = gh_json_lines(
        [
            "api",
            "--paginate",
            f"/repos/{repo}/actions/runs?head_sha={sha}&event=pull_request&per_page=100",
            "--jq",
            ".workflow_runs[] | {id, path, name, status, conclusion, html_url, created_at}",
        ]
    )
    return [
        Run(
            id=int(row["id"]),
            path=row["path"],
            name=row["name"],
            status=row["status"],
            conclusion=row.get("conclusion"),
            html_url=row.get("html_url") or "",
            created_at=parse_timestamp(row["created_at"]),
        )
        for row in rows
    ]


def wait() -> int:
    repo = require_env("REPO")
    number = require_env("PR_NUMBER")
    sha = require_env("HEAD_SHA")
    base_ref = require_env("BASE_REF")
    action = require_env("EVENT_ACTION")
    event_at = parse_timestamp(require_env("EVENT_AT"))
    triggers = load_triggers()
    files = changed_files(repo, number)
    expected = expected_workflows(triggers, files, base_ref, action)
    print(f"Changed files: {len(files)}")
    for name in files[:40]:
        print(f"  {name}")
    if len(files) > 40:
        print(f"  ... {len(files) - 40} more")
    if expected:
        print("Waiting for:")
        for trigger in expected:
            print(f"  {trigger.name} ({trigger.path})")
    else:
        print("No pull request workflows match the changed files.")
        return 0

    started = time.monotonic()
    while True:
        elapsed = time.monotonic() - started
        status, message = evaluate(
            expected,
            workflow_runs(repo, sha),
            elapsed=elapsed,
            event_at=event_at,
        )
        print(message)
        if status == "ok":
            return 0
        if status == "fail":
            return 1
        time.sleep(POLL_SECONDS)


def require_env(name: str) -> str:
    import os

    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def self_test() -> None:
    assert glob_match("ui/**", "ui/pages/index.tsx")
    assert glob_match("ui/**", "ui/a/b.tsx")
    assert not glob_match("ui/**", "uix/a.tsx")
    assert not glob_match("ui/**", "lib/ui/a.tsx")
    assert glob_match(".github/workflows/ci.yml", ".github/workflows/ci.yml")
    assert not glob_match("*.js", "dir/file.js")

    triggers = load_triggers()
    found = {trigger.path for trigger in triggers if trigger.path not in EXCLUDED}
    assert found == {
        ".github/workflows/ci.yml",
        ".github/workflows/deprize-unit.yml",
        ".github/workflows/feehook.yml",
        ".github/workflows/subscription-contracts.yml",
        ".github/workflows/xp.yml",
    }, found
    always_on = [
        trigger.path
        for trigger in triggers
        if trigger.paths is None and trigger.path not in EXCLUDED
    ]
    assert always_on == [], always_on

    cases = [
        (
            ["ui/pages/index.tsx"],
            {
                ".github/workflows/ci.yml",
                ".github/workflows/deprize-unit.yml",
            },
        ),
        (["docs/guide.md"], {".github/workflows/deprize-unit.yml"}),
        (
            ["subscription-contracts/src/A.sol"],
            {".github/workflows/subscription-contracts.yml"},
        ),
        (["xp/src/A.sol"], {".github/workflows/xp.yml"}),
        (["fee-hook/src/Hook.sol"], {".github/workflows/feehook.yml"}),
        (["README.md"], set()),
        ([".github/workflows/ci.yml"], {".github/workflows/ci.yml"}),
        (
            [".github/workflows/subscription-contracts.yml"],
            set(),
        ),
        (
            ["ui/a.tsx", "fee-hook/src/Hook.sol"],
            {
                ".github/workflows/ci.yml",
                ".github/workflows/deprize-unit.yml",
                ".github/workflows/feehook.yml",
            },
        ),
    ]
    for files, expected_paths in cases:
        got = {
            trigger.path
            for trigger in expected_workflows(triggers, files, "main", "synchronize")
        }
        assert got == expected_paths, (files, got, expected_paths)

    cypress = Trigger(
        path=".github/workflows/ci.yml",
        name="Cypress",
        paths=("ui/**",),
        paths_ignore=(),
        branches=("main",),
        branches_ignore=(),
        types=None,
    )
    deprize = Trigger(
        path=".github/workflows/deprize-unit.yml",
        name="DePrize",
        paths=("ui/**",),
        paths_ignore=(),
        branches=None,
        branches_ignore=(),
        types=None,
    )

    def run(
        run_id: int,
        path: str,
        status: str,
        conclusion: str | None,
        created_at: float = 0,
    ) -> Run:
        return Run(
            run_id,
            path,
            path,
            status,
            conclusion,
            f"https://example.test/{run_id}",
            created_at,
        )

    status, _ = evaluate([cypress], [], elapsed=0)
    assert status == "wait"
    status, _ = evaluate([cypress], [], elapsed=APPEAR_TIMEOUT_SECONDS)
    assert status == "fail"
    status, _ = evaluate(
        [cypress],
        [run(1, cypress.path, "in_progress", None)],
        elapsed=APPEAR_TIMEOUT_SECONDS,
    )
    assert status == "wait"
    status, _ = evaluate(
        [cypress],
        [run(1, cypress.path, "completed", "success")],
        elapsed=0,
    )
    assert status == "ok"
    status, _ = evaluate(
        [cypress],
        [run(1, cypress.path, "completed", "failure")],
        elapsed=0,
    )
    assert status == "fail"
    status, _ = evaluate(
        [cypress],
        [
            run(1, cypress.path, "completed", "failure"),
            run(2, cypress.path, "completed", "success"),
        ],
        elapsed=0,
    )
    assert status == "ok"
    status, _ = evaluate(
        [cypress, deprize],
        [
            run(2, cypress.path, "completed", "success"),
            run(3, deprize.path, "completed", "failure"),
        ],
        elapsed=0,
    )
    assert status == "fail"
    status, message = evaluate([], [], elapsed=0)
    assert status == "ok"
    assert "No pull request workflows" in message

    assert parse_timestamp("2026-10-22T18:48:00Z") == parse_timestamp(
        "2026-10-22T18:48:00+00:00"
    )
    previous = 1_700_000_000
    event_at = previous + 3600
    status, message = evaluate(
        [cypress],
        [run(1, cypress.path, "completed", "success", previous)],
        elapsed=0,
        event_at=event_at,
    )
    assert status == "wait", (status, message)
    assert "not started" in message
    status, message = evaluate(
        [cypress],
        [run(1, cypress.path, "completed", "failure", previous)],
        elapsed=0,
        event_at=event_at,
    )
    assert status == "wait", (status, message)
    status, message = evaluate(
        [cypress],
        [run(1, cypress.path, "completed", "success", previous)],
        elapsed=APPEAR_TIMEOUT_SECONDS,
        event_at=event_at,
    )
    assert status == "fail", (status, message)
    assert "never started" in message
    status, _ = evaluate(
        [cypress],
        [
            run(1, cypress.path, "completed", "success", previous),
            run(2, cypress.path, "in_progress", None, event_at + 5),
        ],
        elapsed=APPEAR_TIMEOUT_SECONDS,
        event_at=event_at,
    )
    assert status == "wait"
    status, _ = evaluate(
        [cypress],
        [
            run(1, cypress.path, "completed", "failure", previous),
            run(2, cypress.path, "completed", "success", event_at + 5),
        ],
        elapsed=0,
        event_at=event_at,
    )
    assert status == "ok"
    status, _ = evaluate(
        [cypress],
        [
            run(1, cypress.path, "completed", "success", previous),
            run(2, cypress.path, "completed", "failure", event_at + 5),
        ],
        elapsed=0,
        event_at=event_at,
    )
    assert status == "fail"
    status, _ = evaluate(
        [cypress, deprize],
        [
            run(1, cypress.path, "completed", "success", previous),
            run(2, deprize.path, "completed", "success", previous),
            run(3, deprize.path, "completed", "success", event_at + 5),
        ],
        elapsed=0,
        event_at=event_at,
    )
    assert status == "wait"
    status, _ = evaluate(
        [cypress],
        [run(4, cypress.path, "completed", "success", event_at - SAME_DELIVERY_SKEW_SECONDS)],
        elapsed=0,
        event_at=event_at,
    )
    assert status == "ok"
    status, _ = evaluate(
        [cypress],
        [
            run(
                4,
                cypress.path,
                "completed",
                "success",
                event_at - SAME_DELIVERY_SKEW_SECONDS - 1,
            )
        ],
        elapsed=0,
        event_at=event_at,
    )
    assert status == "wait"
    print("required-checks self-test passed")


def main(argv: list[str]) -> int:
    command = argv[1] if len(argv) > 1 else "self-test"
    if command == "self-test":
        self_test()
        return 0
    if command == "wait":
        return wait()
    print(f"Unknown command {command}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except (RuntimeError, WorkflowParseError) as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)
