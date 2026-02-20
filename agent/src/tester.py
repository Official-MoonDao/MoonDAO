"""
Test runner for Playwright tests

Executes tests across multiple browsers, viewports, and configurations
to detect bugs in the application.
"""

import subprocess
import json
import asyncio
from pathlib import Path
from typing import List, Optional
from datetime import datetime
import structlog

from .config import Settings
from .models import TestResult, TestFailure, ConsoleMessage, NetworkRequest

logger = structlog.get_logger()


class PlaywrightTester:
    """Runs Playwright tests and captures results"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.results_path = settings.results_path
        self.ui_path = settings.repo_path / "ui"
    
    async def _run_playwright(
        self,
        project: Optional[str] = None,
        test_pattern: Optional[str] = None,
        extra_args: Optional[List[str]] = None,
    ) -> dict:
        """Run Playwright tests and return JSON results"""
        cmd = [
            "npx", "playwright", "test",
            "--reporter=json",
        ]
        
        if project:
            cmd.extend(["--project", project])
        
        if test_pattern:
            cmd.append(test_pattern)
        
        if extra_args:
            cmd.extend(extra_args)
        
        logger.info("running_playwright", command=" ".join(cmd))
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=self.ui_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={
                **dict(__import__('os').environ),
                "BASE_URL": self.settings.base_url,
                "CI": "true",
            },
        )
        
        stdout, stderr = await process.communicate()
        
        # Parse JSON output
        try:
            results = json.loads(stdout.decode())
        except json.JSONDecodeError:
            logger.warning("failed_to_parse_results", stderr=stderr.decode()[:500])
            results = {"suites": [], "stats": {}}
        
        return results
    
    def _parse_failures(self, results: dict) -> List[TestFailure]:
        """Parse Playwright JSON results into TestFailure objects"""
        failures = []
        
        def process_suite(suite: dict, browser: str = "unknown"):
            for spec in suite.get("specs", []):
                for test in spec.get("tests", []):
                    for result in test.get("results", []):
                        if result.get("status") == "failed":
                            failure = TestFailure(
                                test_name=spec.get("title", "Unknown"),
                                test_file=spec.get("file", "Unknown"),
                                browser=browser,
                                viewport=test.get("projectName", "unknown"),
                                error_message=self._extract_error(result),
                                screenshot_path=self._find_attachment(result, "screenshot"),
                                video_path=self._find_attachment(result, "video"),
                                console_logs=self._parse_console_logs(result),
                                network_logs=[],  # Would need custom reporter
                                timestamp=datetime.now(),
                            )
                            failures.append(failure)
            
            for child_suite in suite.get("suites", []):
                process_suite(child_suite, browser)
        
        for suite in results.get("suites", []):
            project_name = suite.get("title", "").split(" - ")[0] if " - " in suite.get("title", "") else "unknown"
            process_suite(suite, project_name)
        
        return failures
    
    def _extract_error(self, result: dict) -> str:
        """Extract error message from test result"""
        error = result.get("error", {})
        if isinstance(error, dict):
            return error.get("message", str(error))
        return str(error) if error else "Unknown error"
    
    def _find_attachment(self, result: dict, attachment_type: str) -> Optional[str]:
        """Find attachment path in test result"""
        for attachment in result.get("attachments", []):
            if attachment.get("name", "").startswith(attachment_type):
                return attachment.get("path")
        return None
    
    def _parse_console_logs(self, result: dict) -> List[ConsoleMessage]:
        """Parse console logs from test result"""
        logs = []
        # This would require custom Playwright reporter to capture
        # For now, return empty list
        return logs
    
    async def run_exploratory_tests(self) -> TestResult:
        """
        Run exploratory tests across all browsers and viewports.
        
        This runs the full test suite to detect bugs.
        """
        logger.info("running_exploratory_tests")
        
        results = await self._run_playwright(
            project="exploratory",
            test_pattern="playwright/tests/exploratory/",
        )
        
        stats = results.get("stats", {})
        failures = self._parse_failures(results)
        
        return TestResult(
            passed=stats.get("unexpected", 0) == 0,
            total_tests=stats.get("expected", 0) + stats.get("unexpected", 0),
            passed_tests=stats.get("expected", 0),
            failed_tests=stats.get("unexpected", 0),
            skipped_tests=stats.get("skipped", 0),
            duration_ms=stats.get("duration", 0),
            failures=failures,
        )
    
    async def run_regression_tests(self) -> TestResult:
        """
        Run regression tests to verify fixes.
        
        This runs a smaller set of critical tests.
        """
        logger.info("running_regression_tests")
        
        results = await self._run_playwright(
            test_pattern="playwright/tests/regression/",
        )
        
        stats = results.get("stats", {})
        failures = self._parse_failures(results)
        
        return TestResult(
            passed=stats.get("unexpected", 0) == 0,
            total_tests=stats.get("expected", 0) + stats.get("unexpected", 0),
            passed_tests=stats.get("expected", 0),
            failed_tests=stats.get("unexpected", 0),
            skipped_tests=stats.get("skipped", 0),
            duration_ms=stats.get("duration", 0),
            failures=failures,
        )
    
    async def run_specific_test(self, test_file: str) -> TestResult:
        """Run a specific test file"""
        logger.info("running_specific_test", test_file=test_file)
        
        results = await self._run_playwright(test_pattern=test_file)
        
        stats = results.get("stats", {})
        failures = self._parse_failures(results)
        
        return TestResult(
            passed=stats.get("unexpected", 0) == 0,
            total_tests=stats.get("expected", 0) + stats.get("unexpected", 0),
            passed_tests=stats.get("expected", 0),
            failed_tests=stats.get("unexpected", 0),
            skipped_tests=stats.get("skipped", 0),
            duration_ms=stats.get("duration", 0),
            failures=failures,
        )
    
    async def get_test_artifacts(self, failure: TestFailure) -> dict:
        """Get all artifacts for a test failure"""
        artifacts = {
            "screenshot": None,
            "video": None,
            "trace": None,
        }
        
        if failure.screenshot_path and Path(failure.screenshot_path).exists():
            artifacts["screenshot"] = Path(failure.screenshot_path).read_bytes()
        
        if failure.video_path and Path(failure.video_path).exists():
            artifacts["video"] = Path(failure.video_path).read_bytes()
        
        return artifacts
