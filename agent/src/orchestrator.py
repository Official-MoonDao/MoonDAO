"""
Main orchestrator for the bug detection agent

Manages the state machine and coordinates all agent components.
"""

import asyncio
import json
from pathlib import Path
from datetime import datetime
from typing import Optional, List

import typer
import structlog
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from .config import get_settings, Settings
from .models import (
    AgentState,
    BugReport,
    BugHypothesis,
    TestResult,
    ScanResult,
    CodeFix,
)
from .scanner import RepoScanner
from .tester import PlaywrightTester
from .analyzer import BugAnalyzer
from .reporter import GitHubReporter
from .fixer import CodeFixer
from .reviewer import CodeReviewer

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.dev.ConsoleRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()
console = Console()
app = typer.Typer(help="MoonDAO Bug Detection Agent")


class BugAgentOrchestrator:
    """
    Main orchestrator that manages the bug detection workflow.
    
    State Machine:
    IDLE -> SCANNING -> TESTING -> ANALYZING -> REPORTING -> WAITING_CONFIRMATION
                                                                    |
                                                                    v
    COMPLETED <- CREATING_PR <- TESTING_FIX <- REVIEWING <- FIXING <-
    """
    
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self.state = AgentState.IDLE
        self.current_reports: List[BugReport] = []
        
        # Initialize components
        self.scanner = RepoScanner(self.settings)
        self.tester = PlaywrightTester(self.settings)
        self.analyzer = BugAnalyzer(self.settings)
        self.reporter = GitHubReporter(self.settings)
        self.fixer = CodeFixer(self.settings)
        self.reviewer = CodeReviewer(self.settings)
        
        # State persistence
        self.state_file = self.settings.results_path / "agent_state.json"
    
    def _transition_to(self, new_state: AgentState) -> None:
        """Transition to a new state with logging"""
        logger.info(
            "state_transition",
            from_state=self.state.value,
            to_state=new_state.value
        )
        self.state = new_state
    
    async def _save_state(self) -> None:
        """Persist current state to disk"""
        state_data = {
            "state": self.state.value,
            "reports": [r.model_dump() for r in self.current_reports],
            "updated_at": datetime.now().isoformat(),
        }
        
        self.settings.results_path.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(json.dumps(state_data, indent=2, default=str))
    
    async def _load_state(self) -> None:
        """Load persisted state from disk"""
        if self.state_file.exists():
            try:
                state_data = json.loads(self.state_file.read_text())
                self.state = AgentState(state_data.get("state", "idle"))
                self.current_reports = [
                    BugReport.model_validate(r) 
                    for r in state_data.get("reports", [])
                ]
                logger.info("loaded_state", state=self.state.value, reports=len(self.current_reports))
            except Exception as e:
                logger.warning("failed_to_load_state", error=str(e))
    
    async def run_cycle(self) -> None:
        """
        Run a complete bug detection cycle.
        
        1. Scan repository for changes
        2. Run tests across browsers/viewports
        3. Analyze failures with Claude
        4. Create bug reports on GitHub
        """
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            try:
                # Phase 1: Scanning
                task = progress.add_task("Scanning repository...", total=None)
                self._transition_to(AgentState.SCANNING)
                scan_result = await self.scanner.scan()
                
                if not scan_result.has_changes:
                    logger.info("no_changes_detected")
                    progress.update(task, description="No changes detected")
                    self._transition_to(AgentState.IDLE)
                    return
                
                logger.info(
                    "changes_detected",
                    files=len(scan_result.changed_files),
                    commits=len(scan_result.new_commits)
                )
                
                # Phase 2: Testing
                progress.update(task, description="Running tests...")
                self._transition_to(AgentState.TESTING)
                test_result = await self.tester.run_exploratory_tests()
                
                if not test_result.failures:
                    logger.info("all_tests_passed")
                    progress.update(task, description="All tests passed!")
                    self._transition_to(AgentState.IDLE)
                    return
                
                logger.info(
                    "tests_failed",
                    total=test_result.total_tests,
                    failed=test_result.failed_tests
                )
                
                # Phase 3: Analyzing
                progress.update(task, description="Analyzing failures with AI...")
                self._transition_to(AgentState.ANALYZING)
                
                bugs_reported = 0
                for failure in test_result.failures[:self.settings.max_bugs_per_cycle]:
                    hypothesis = await self.analyzer.analyze_failure(failure)
                    
                    if hypothesis and hypothesis.confidence >= 0.6:
                        # Phase 4: Reporting
                        progress.update(task, description=f"Creating bug report: {hypothesis.title[:50]}...")
                        self._transition_to(AgentState.REPORTING)
                        
                        report = await self.reporter.create_bug_report(hypothesis)
                        self.current_reports.append(report)
                        bugs_reported += 1
                        
                        logger.info(
                            "bug_reported",
                            title=hypothesis.title,
                            severity=hypothesis.severity.value,
                            issue_number=report.issue_number
                        )
                
                await self._save_state()
                
                progress.update(
                    task, 
                    description=f"Cycle complete: {bugs_reported} bugs reported"
                )
                self._transition_to(AgentState.WAITING_CONFIRMATION)
                
            except Exception as e:
                logger.error("cycle_failed", error=str(e))
                self._transition_to(AgentState.FAILED)
                raise
    
    async def handle_confirmation(self, issue_number: int) -> None:
        """
        Handle bug confirmation and generate fix.
        
        Called when a developer adds the 'confirmed' label to a bug issue.
        
        1. Load bug hypothesis
        2. Generate code fix with Claude
        3. Run self-review
        4. Run tests on fix
        5. Create PR if tests pass
        """
        await self._load_state()
        
        # Find the report for this issue
        report = next(
            (r for r in self.current_reports if r.issue_number == issue_number),
            None
        )
        
        if not report:
            logger.warning("report_not_found", issue_number=issue_number)
            return
        
        report.confirmed = True
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            try:
                # Phase 5: Fixing
                task = progress.add_task("Generating fix...", total=None)
                self._transition_to(AgentState.FIXING)
                
                fixes = await self.fixer.generate_fix(report.hypothesis)
                
                if not fixes:
                    logger.warning("no_fix_generated", issue_number=issue_number)
                    await self.reporter.add_comment(
                        issue_number,
                        "❌ Unable to generate an automated fix for this issue. Manual intervention required."
                    )
                    return
                
                # Phase 6: Reviewing
                progress.update(task, description="Self-reviewing code...")
                self._transition_to(AgentState.REVIEWING)
                
                reviewed_fixes = []
                for fix in fixes:
                    reviewed_fix = await self.reviewer.review_and_improve(fix)
                    reviewed_fixes.append(reviewed_fix)
                
                report.proposed_fixes = reviewed_fixes
                
                # Phase 7: Testing fix
                progress.update(task, description="Testing fix...")
                self._transition_to(AgentState.TESTING_FIX)
                
                # Apply fixes temporarily
                await self.fixer.apply_fixes(reviewed_fixes)
                
                # Run tests
                test_result = await self.tester.run_regression_tests()
                
                if not test_result.passed:
                    logger.warning("fix_tests_failed", failures=test_result.failed_tests)
                    await self.fixer.revert_fixes(reviewed_fixes)
                    await self.reporter.add_comment(
                        issue_number,
                        f"⚠️ Generated fix failed tests ({test_result.failed_tests} failures). Reverting and retrying..."
                    )
                    # Could implement retry logic here
                    return
                
                # Phase 8: Creating PR
                progress.update(task, description="Creating pull request...")
                self._transition_to(AgentState.CREATING_PR)
                
                pr = await self.reporter.create_pull_request(report)
                report.pr_number = pr.number
                report.pr_url = pr.html_url
                report.fixed = True
                
                await self._save_state()
                
                logger.info(
                    "fix_complete",
                    issue_number=issue_number,
                    pr_number=pr.number
                )
                
                progress.update(task, description=f"PR created: #{pr.number}")
                self._transition_to(AgentState.COMPLETED)
                
            except Exception as e:
                logger.error("fix_failed", error=str(e), issue_number=issue_number)
                self._transition_to(AgentState.FAILED)
                await self.reporter.add_comment(
                    issue_number,
                    f"❌ Error generating fix: {str(e)}"
                )
                raise


# CLI Commands
@app.command()
def run_cycle():
    """Run a complete bug detection cycle"""
    orchestrator = BugAgentOrchestrator()
    asyncio.run(orchestrator.run_cycle())


@app.command()
def handle_confirmation(issue_number: int):
    """Handle bug confirmation and generate fix"""
    orchestrator = BugAgentOrchestrator()
    asyncio.run(orchestrator.handle_confirmation(issue_number))


@app.command()
def status():
    """Show current agent status"""
    settings = get_settings()
    state_file = settings.results_path / "agent_state.json"
    
    if state_file.exists():
        state_data = json.loads(state_file.read_text())
        console.print(f"[bold]State:[/bold] {state_data.get('state', 'unknown')}")
        console.print(f"[bold]Reports:[/bold] {len(state_data.get('reports', []))}")
        console.print(f"[bold]Last Updated:[/bold] {state_data.get('updated_at', 'unknown')}")
    else:
        console.print("[yellow]No state file found. Agent has not run yet.[/yellow]")


def main():
    """Entry point for the CLI"""
    app()


if __name__ == "__main__":
    main()
