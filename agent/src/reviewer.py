"""
Code reviewer using Claude AI

Reviews generated fixes for quality, style, and correctness.
"""

import subprocess
import json
from typing import List, Optional
from pathlib import Path
import structlog

from .config import Settings
from .models import CodeFix
from .tools.claude import ClaudeClient

logger = structlog.get_logger()


CODE_REVIEW_PROMPT = """You are a senior software engineer reviewing code changes.

## Review Criteria
1. **Correctness**: Does the change fix the issue without introducing new bugs?
2. **Style**: Does it follow the project's coding conventions?
3. **Readability**: Is the code clear and well-structured?
4. **Performance**: Are there any performance concerns?
5. **Security**: Are there any security implications?
6. **Edge Cases**: Are edge cases handled properly?

## Project Conventions
- TypeScript with strict mode
- React functional components with hooks
- Tailwind CSS for styling
- Clear, descriptive variable names
- Minimal comments (code should be self-documenting)

## Your Task
Review the code change and suggest improvements. Be constructive and specific.

## Response Format
{
  "approved": boolean,
  "issues": [
    {
      "severity": "error|warning|suggestion",
      "description": "What the issue is",
      "fix": "How to fix it"
    }
  ],
  "improved_code": "The improved version of the code (if changes needed)"
}
"""


class CodeReviewer:
    """Reviews and improves generated code fixes"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.claude = ClaudeClient(settings)
        self.repo_path = settings.repo_path
    
    async def review_and_improve(self, fix: CodeFix) -> CodeFix:
        """
        Review a code fix and improve it if needed.
        
        Args:
            fix: The code fix to review
        
        Returns:
            Improved CodeFix (may be same as input if no changes needed)
        """
        logger.info("reviewing_fix", path=fix.file_path)
        
        # Step 1: Run linting
        lint_passed, lint_errors = await self._run_linting(fix)
        
        # Step 2: AI review
        review_context = f"""
## Code Change to Review

**File**: `{fix.file_path}`

**Description**: {fix.description}

### Original Code
```typescript
{fix.original_content}
```

### Proposed Change
```typescript
{fix.fixed_content}
```
"""
        
        if lint_errors:
            review_context += f"\n### Linting Errors\n```\n{lint_errors}\n```\n"
        
        try:
            response = await self.claude.analyze(
                system_prompt=CODE_REVIEW_PROMPT,
                user_message=review_context,
            )
            
            review = self._parse_review(response)
            
            if review and not review.get("approved"):
                # Apply improvements
                improved_code = review.get("improved_code")
                if improved_code and improved_code != fix.fixed_content:
                    logger.info(
                        "fix_improved",
                        path=fix.file_path,
                        issues=len(review.get("issues", []))
                    )
                    
                    fix.fixed_content = improved_code
                    fix.self_review_notes = [
                        f"[{i['severity']}] {i['description']}" 
                        for i in review.get("issues", [])
                    ]
        
        except Exception as e:
            logger.warning("review_failed", error=str(e))
        
        # Step 3: Format code
        formatted = await self._format_code(fix)
        if formatted:
            fix.fixed_content = formatted
        
        # Step 4: Final lint check
        fix.linting_passed, _ = await self._run_linting(fix)
        
        return fix
    
    async def _run_linting(self, fix: CodeFix) -> tuple[bool, str]:
        """
        Run ESLint on the fixed code.
        
        Returns:
            Tuple of (passed, error_message)
        """
        try:
            # Create temp file with fixed content
            temp_path = self.repo_path / "ui" / ".temp_review.tsx"
            
            # Get full file content with fix applied
            original_path = self.repo_path / "ui" / fix.file_path
            if not original_path.exists():
                return True, ""
            
            full_content = original_path.read_text()
            fixed_content = full_content.replace(
                fix.original_content, 
                fix.fixed_content, 
                1
            )
            temp_path.write_text(fixed_content)
            
            # Run ESLint
            result = subprocess.run(
                ["npx", "eslint", "--format", "json", str(temp_path)],
                cwd=self.repo_path / "ui",
                capture_output=True,
                text=True,
                timeout=30,
            )
            
            # Clean up
            temp_path.unlink(missing_ok=True)
            
            if result.returncode == 0:
                return True, ""
            
            # Parse ESLint output
            try:
                lint_results = json.loads(result.stdout)
                errors = []
                for file_result in lint_results:
                    for msg in file_result.get("messages", []):
                        if msg.get("severity", 0) >= 2:  # Error level
                            errors.append(
                                f"Line {msg.get('line')}: {msg.get('message')}"
                            )
                return False, "\n".join(errors)
            except json.JSONDecodeError:
                return False, result.stdout
            
        except subprocess.TimeoutExpired:
            logger.warning("linting_timeout")
            return True, ""
        except Exception as e:
            logger.warning("linting_error", error=str(e))
            return True, ""
    
    async def _format_code(self, fix: CodeFix) -> Optional[str]:
        """
        Format code using Prettier.
        
        Returns:
            Formatted code or None if formatting fails
        """
        try:
            result = subprocess.run(
                ["npx", "prettier", "--parser", "typescript"],
                input=fix.fixed_content,
                capture_output=True,
                text=True,
                cwd=self.repo_path / "ui",
                timeout=10,
            )
            
            if result.returncode == 0:
                return result.stdout
            
        except Exception as e:
            logger.warning("formatting_error", error=str(e))
        
        return None
    
    def _parse_review(self, response: str) -> Optional[dict]:
        """Parse review data from Claude response"""
        try:
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                return json.loads(json_str)
        except json.JSONDecodeError:
            pass
        
        return None
    
    async def check_test_coverage(self, fix: CodeFix) -> bool:
        """
        Check if the fix has adequate test coverage.
        
        Returns:
            True if tests exist for the affected code
        """
        # Look for existing tests for the file
        file_name = Path(fix.file_path).stem
        test_patterns = [
            f"**/{file_name}.spec.ts",
            f"**/{file_name}.spec.tsx",
            f"**/{file_name}.test.ts",
            f"**/{file_name}.test.tsx",
            f"**/{file_name}.cy.ts",
            f"**/{file_name}.cy.tsx",
        ]
        
        for pattern in test_patterns:
            matches = list((self.repo_path / "ui").glob(pattern))
            if matches:
                return True
        
        return False
    
    async def validate_typescript(self, fix: CodeFix) -> tuple[bool, str]:
        """
        Run TypeScript compiler check on the fix.
        
        Returns:
            Tuple of (passed, error_message)
        """
        try:
            # Type check the whole project (needed for imports)
            result = subprocess.run(
                ["npx", "tsc", "--noEmit", "--pretty", "false"],
                cwd=self.repo_path / "ui",
                capture_output=True,
                text=True,
                timeout=120,
            )
            
            if result.returncode == 0:
                return True, ""
            
            # Filter errors to ones related to our file
            errors = []
            for line in result.stdout.split("\n"):
                if fix.file_path in line:
                    errors.append(line)
            
            return len(errors) == 0, "\n".join(errors)
            
        except subprocess.TimeoutExpired:
            logger.warning("typescript_check_timeout")
            return True, ""
        except Exception as e:
            logger.warning("typescript_check_error", error=str(e))
            return True, ""
