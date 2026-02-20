"""
Bug analyzer using Claude AI

Analyzes test failures and generates hypotheses about the root cause.
"""

import json
from typing import Optional, List
from pathlib import Path
import structlog

from .config import Settings
from .models import (
    BugHypothesis,
    BugSeverity,
    BugCategory,
    TestFailure,
)
from .tools.claude import ClaudeClient

logger = structlog.get_logger()


BUG_ANALYSIS_PROMPT = """You are an expert software engineer analyzing test failures in a Next.js web application.

## Application Context
- **Framework**: Next.js 13 with React 18
- **Blockchain**: Thirdweb v5, Privy authentication, wagmi/viem
- **Styling**: Tailwind CSS, DaisyUI
- **Testing**: Playwright for E2E and component tests

## Your Task
Analyze the test failure and determine:
1. Whether this is a real bug or test flakiness
2. The root cause of the failure
3. Which source files are likely responsible
4. The severity and category of the bug
5. Steps to reproduce the issue

## Important Guidelines
- Be conservative: only report bugs with high confidence (>0.7)
- Distinguish between app bugs and test issues
- Consider browser-specific quirks
- Look for patterns in console errors and network failures
- Consider responsive design issues for viewport-related failures

## Response Format
Provide your analysis as a JSON object with this structure:
{
  "is_real_bug": boolean,
  "confidence": float (0.0-1.0),
  "title": "Brief descriptive title",
  "description": "Detailed description of the issue",
  "severity": "critical|high|medium|low|info",
  "category": "crash|functional|visual|performance|accessibility|security|responsive|wallet|api",
  "root_cause": "Explanation of what's causing the issue",
  "affected_files": ["list", "of", "file", "paths"],
  "affected_components": ["list", "of", "component", "names"],
  "reproduction_steps": ["step 1", "step 2", ...],
  "suggested_fix": "Brief description of how to fix this"
}
"""


class BugAnalyzer:
    """Analyzes test failures to identify bugs"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.claude = ClaudeClient(settings)
        self.repo_path = settings.repo_path
    
    def _format_failure_context(self, failure: TestFailure) -> str:
        """Format test failure into context for Claude"""
        context = f"""
## Test Failure Details

**Test Name**: {failure.test_name}
**Test File**: {failure.test_file}
**Browser**: {failure.browser}
**Viewport**: {failure.viewport}
**Timestamp**: {failure.timestamp.isoformat()}

### Error Message
```
{failure.error_message}
```

### Console Logs
"""
        
        if failure.console_logs:
            for log in failure.console_logs[-20:]:  # Last 20 logs
                context += f"[{log.type}] {log.text}\n"
        else:
            context += "No console logs captured.\n"
        
        context += "\n### Network Errors\n"
        
        failed_requests = [r for r in failure.network_logs if r.failed or (r.status and r.status >= 400)]
        if failed_requests:
            for req in failed_requests[:10]:  # First 10 failed requests
                context += f"- {req.method} {req.url} -> {req.status or 'FAILED'}"
                if req.error:
                    context += f" ({req.error})"
                context += "\n"
        else:
            context += "No network errors captured.\n"
        
        if failure.dom_snapshot:
            # Include truncated DOM for context
            dom_preview = failure.dom_snapshot[:5000] if len(failure.dom_snapshot) > 5000 else failure.dom_snapshot
            context += f"\n### DOM Snapshot (truncated)\n```html\n{dom_preview}\n```\n"
        
        return context
    
    def _load_screenshot(self, failure: TestFailure) -> Optional[bytes]:
        """Load screenshot bytes if available"""
        if failure.screenshot_path:
            path = Path(failure.screenshot_path)
            if path.exists():
                return path.read_bytes()
        return None
    
    async def analyze_failure(self, failure: TestFailure) -> Optional[BugHypothesis]:
        """
        Analyze a test failure and generate a bug hypothesis.
        
        Args:
            failure: TestFailure object with all captured data
        
        Returns:
            BugHypothesis if a real bug is detected, None otherwise
        """
        logger.info(
            "analyzing_failure",
            test_name=failure.test_name,
            browser=failure.browser,
            viewport=failure.viewport
        )
        
        # Prepare context
        context = self._format_failure_context(failure)
        
        # Load screenshot if available
        screenshot = self._load_screenshot(failure)
        images = [screenshot] if screenshot else None
        
        # Define tool handler for code exploration
        async def tool_handler(tool_name: str, tool_input: dict) -> str:
            if tool_name == "read_file":
                path = self.repo_path / "ui" / tool_input["path"]
                if path.exists():
                    return path.read_text()[:10000]  # Limit size
                return f"File not found: {tool_input['path']}"
            
            elif tool_name == "search_codebase":
                # Simple grep-like search
                import subprocess
                try:
                    result = subprocess.run(
                        ["grep", "-r", "-l", tool_input["query"], 
                         "--include", tool_input.get("file_pattern", "*.tsx")],
                        cwd=self.repo_path / "ui",
                        capture_output=True,
                        text=True,
                        timeout=10,
                    )
                    return result.stdout or "No matches found"
                except Exception as e:
                    return f"Search error: {e}"
            
            elif tool_name == "list_directory":
                path = self.repo_path / "ui" / tool_input["path"]
                if path.exists() and path.is_dir():
                    files = list(path.iterdir())[:50]  # Limit results
                    return "\n".join(f.name for f in files)
                return f"Directory not found: {tool_input['path']}"
            
            return f"Unknown tool: {tool_name}"
        
        # Call Claude for analysis
        try:
            response = await self.claude.analyze(
                system_prompt=BUG_ANALYSIS_PROMPT,
                user_message=context,
                images=images,
                use_tools=True,
                tool_handler=tool_handler,
            )
            
            # Parse response
            analysis = self._parse_analysis(response)
            
            if not analysis or not analysis.get("is_real_bug"):
                logger.info("not_a_bug", test_name=failure.test_name)
                return None
            
            if analysis.get("confidence", 0) < 0.6:
                logger.info(
                    "low_confidence",
                    test_name=failure.test_name,
                    confidence=analysis.get("confidence")
                )
                return None
            
            # Build hypothesis
            hypothesis = BugHypothesis(
                title=analysis.get("title", "Unknown Bug"),
                description=analysis.get("description", ""),
                severity=BugSeverity(analysis.get("severity", "medium")),
                category=BugCategory(analysis.get("category", "functional")),
                confidence=analysis.get("confidence", 0.7),
                root_cause=analysis.get("root_cause", "Unknown"),
                affected_files=analysis.get("affected_files", []),
                affected_components=analysis.get("affected_components", []),
                reproduction_steps=analysis.get("reproduction_steps", []),
                affected_browsers=[failure.browser],
                affected_viewports=[failure.viewport],
                suggested_fix=analysis.get("suggested_fix"),
                test_failures=[failure],
            )
            
            logger.info(
                "bug_detected",
                title=hypothesis.title,
                severity=hypothesis.severity.value,
                confidence=hypothesis.confidence
            )
            
            return hypothesis
            
        except Exception as e:
            logger.error("analysis_failed", error=str(e))
            return None
    
    def _parse_analysis(self, response: str) -> Optional[dict]:
        """Parse JSON analysis from Claude response"""
        try:
            # Find JSON in response
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                return json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.warning("json_parse_error", error=str(e))
        
        return None
    
    async def correlate_failures(
        self,
        failures: List[TestFailure]
    ) -> List[BugHypothesis]:
        """
        Analyze multiple failures and correlate them into unique bugs.
        
        Multiple test failures might be caused by the same underlying bug.
        This method groups related failures.
        """
        hypotheses = []
        
        for failure in failures:
            hypothesis = await self.analyze_failure(failure)
            if hypothesis:
                # Check if this matches an existing hypothesis
                matched = False
                for existing in hypotheses:
                    if self._are_related(existing, hypothesis):
                        # Merge into existing
                        existing.test_failures.extend(hypothesis.test_failures)
                        existing.affected_browsers = list(set(
                            existing.affected_browsers + hypothesis.affected_browsers
                        ))
                        existing.affected_viewports = list(set(
                            existing.affected_viewports + hypothesis.affected_viewports
                        ))
                        matched = True
                        break
                
                if not matched:
                    hypotheses.append(hypothesis)
        
        return hypotheses
    
    def _are_related(self, h1: BugHypothesis, h2: BugHypothesis) -> bool:
        """Check if two hypotheses are likely the same bug"""
        # Same affected files
        if set(h1.affected_files) & set(h2.affected_files):
            return True
        
        # Same root cause keywords
        h1_words = set(h1.root_cause.lower().split())
        h2_words = set(h2.root_cause.lower().split())
        overlap = len(h1_words & h2_words)
        if overlap > 5:
            return True
        
        return False
