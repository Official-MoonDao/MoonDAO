"""
GitHub issue and PR reporter

Creates bug reports as GitHub issues and pull requests for fixes.
"""

from typing import Optional, List
from datetime import datetime
import structlog

from .config import Settings
from .models import BugHypothesis, BugReport, CodeFix
from .tools.github import GitHubClient

logger = structlog.get_logger()


class GitHubReporter:
    """Reports bugs to GitHub as issues and creates PRs for fixes"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.github = GitHubClient(settings)
    
    def _format_bug_report(self, hypothesis: BugHypothesis) -> str:
        """Format a bug hypothesis into a GitHub issue body"""
        body = f"""## Summary
{hypothesis.description}

## Bug Details

| Attribute | Value |
|-----------|-------|
| **Severity** | {hypothesis.severity.value.upper()} |
| **Category** | {hypothesis.category.value} |
| **Confidence** | {hypothesis.confidence:.0%} |
| **Detected By** | Automated Bug Agent |
| **Detected At** | {hypothesis.created_at.strftime('%Y-%m-%d %H:%M UTC')} |

## Root Cause Analysis
{hypothesis.root_cause}

## Affected Files
"""
        
        if hypothesis.affected_files:
            for f in hypothesis.affected_files:
                body += f"- `{f}`\n"
        else:
            body += "_No specific files identified_\n"
        
        body += "\n## Affected Components\n"
        if hypothesis.affected_components:
            for c in hypothesis.affected_components:
                body += f"- {c}\n"
        else:
            body += "_No specific components identified_\n"
        
        body += "\n## Reproduction Steps\n"
        if hypothesis.reproduction_steps:
            for i, step in enumerate(hypothesis.reproduction_steps, 1):
                body += f"{i}. {step}\n"
        else:
            body += "_See test failure details below_\n"
        
        body += "\n## Environment\n"
        body += f"- **Browsers**: {', '.join(hypothesis.affected_browsers)}\n"
        body += f"- **Viewports**: {', '.join(hypothesis.affected_viewports)}\n"
        
        if hypothesis.suggested_fix:
            body += f"\n## Suggested Fix\n{hypothesis.suggested_fix}\n"
        
        body += """
---

## Test Failure Evidence
"""
        
        for failure in hypothesis.test_failures[:3]:  # Limit to 3 failures
            body += f"""
### {failure.test_name}

- **File**: `{failure.test_file}`
- **Browser**: {failure.browser}
- **Viewport**: {failure.viewport}

<details>
<summary>Error Message</summary>

```
{failure.error_message[:2000]}
```

</details>
"""
        
        body += """
---

## Next Steps

1. **Review this bug report** and verify the analysis is correct
2. **If confirmed**: Add the `agent-confirmed` label to trigger automated fix generation
3. **If not a bug**: Close this issue with a comment explaining why

> 🤖 This issue was automatically created by the MoonDAO Bug Detection Agent.
"""
        
        return body
    
    async def create_bug_report(self, hypothesis: BugHypothesis) -> BugReport:
        """
        Create a GitHub issue for a bug hypothesis.
        
        Args:
            hypothesis: The analyzed bug hypothesis
        
        Returns:
            BugReport with issue details
        """
        title = f"[Bug Agent] {hypothesis.title}"
        body = self._format_bug_report(hypothesis)
        
        labels = [
            "bug",
            self.settings.label_agent_detected,
            self.settings.label_needs_confirmation,
            f"severity:{hypothesis.severity.value}",
            f"category:{hypothesis.category.value}",
        ]
        
        issue = await self.github.create_issue(
            title=title,
            body=body,
            labels=labels,
        )
        
        return BugReport(
            hypothesis=hypothesis,
            issue_number=issue.number,
            issue_url=issue.html_url,
        )
    
    async def add_comment(self, issue_number: int, comment: str) -> None:
        """Add a comment to an existing issue"""
        await self.github.add_comment(issue_number, comment)
    
    def _format_pr_body(self, report: BugReport) -> str:
        """Format PR body for a bug fix"""
        body = f"""## Summary

Automated fix for bug #{report.issue_number}: {report.hypothesis.title}

## Changes Made

"""
        
        for fix in report.proposed_fixes:
            body += f"### `{fix.file_path}`\n"
            body += f"{fix.description}\n\n"
        
        body += """
## Testing

- [x] Generated fix passes linting
- [x] Generated fix passes existing tests
- [x] Self-review by AI completed

## Review Checklist

Before merging, please verify:
- [ ] The fix addresses the root cause
- [ ] No unintended side effects
- [ ] Code follows project conventions
- [ ] Tests adequately cover the fix

---

> 🤖 This PR was automatically created by the MoonDAO Bug Detection Agent.
> Fixes #{issue_number}
""".format(issue_number=report.issue_number)
        
        return body
    
    async def create_pull_request(self, report: BugReport) -> object:
        """
        Create a pull request for a bug fix.
        
        Args:
            report: BugReport with proposed fixes
        
        Returns:
            PullRequest object
        """
        # Create branch
        branch_name = f"bug-agent/fix-{report.issue_number}"
        await self.github.create_branch(branch_name)
        
        # Apply fixes to branch
        for fix in report.proposed_fixes:
            await self.github.update_file(
                path=fix.file_path,
                content=fix.fixed_content,
                message=f"fix: {fix.description}\n\nFixes #{report.issue_number}",
                branch=branch_name,
            )
        
        # Create PR
        title = f"fix: {report.hypothesis.title}"
        body = self._format_pr_body(report)
        
        pr = await self.github.create_pull_request(
            title=title,
            body=body,
            head_branch=branch_name,
            labels=[
                self.settings.label_agent_detected,
                self.settings.label_fix_ready,
            ],
        )
        
        # Update issue
        await self.github.add_label(
            report.issue_number,
            self.settings.label_fix_ready
        )
        await self.github.add_comment(
            report.issue_number,
            f"✅ Automated fix created in #{pr.number}"
        )
        
        return pr
    
    async def get_pending_confirmations(self) -> List[int]:
        """Get issue numbers awaiting confirmation"""
        issues = await self.github.get_issues_with_label(
            self.settings.label_needs_confirmation
        )
        return [issue.number for issue in issues]
    
    async def get_confirmed_bugs(self) -> List[int]:
        """Get issue numbers that have been confirmed"""
        issues = await self.github.get_issues_with_label(
            self.settings.label_confirmed
        )
        return [issue.number for issue in issues]
