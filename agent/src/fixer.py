"""
Code fixer using Claude AI

Generates code fixes for detected bugs based on the hypothesis.
"""

import json
from typing import List, Optional
from pathlib import Path
import structlog

from .config import Settings
from .models import BugHypothesis, CodeFix
from .tools.claude import ClaudeClient

logger = structlog.get_logger()


FIX_GENERATION_PROMPT = """You are an expert software engineer fixing bugs in a Next.js web application.

## Application Context
- **Framework**: Next.js 13 with React 18
- **Blockchain**: Thirdweb v5, Privy authentication, wagmi/viem
- **Styling**: Tailwind CSS, DaisyUI
- **TypeScript**: Strict mode enabled

## Your Task
Generate a minimal, focused fix for the reported bug. The fix should:
1. Address the root cause, not just symptoms
2. Be as small as possible while fully fixing the issue
3. Follow existing code patterns and conventions
4. Not introduce any new dependencies unless absolutely necessary
5. Maintain backward compatibility

## Important Guidelines
- Only modify files that are directly related to the bug
- Preserve existing formatting and style
- Add comments only if the fix is non-obvious
- Consider edge cases and error handling
- Ensure TypeScript types are correct

## Response Format
For each file that needs to be modified, provide:
{
  "fixes": [
    {
      "file_path": "path/to/file.tsx",
      "description": "Brief description of what this change does",
      "old_content": "The exact content to replace (include enough context to be unique)",
      "new_content": "The replacement content"
    }
  ],
  "explanation": "Overall explanation of the fix approach"
}
"""


class CodeFixer:
    """Generates and applies code fixes for bugs"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.claude = ClaudeClient(settings)
        self.repo_path = settings.repo_path
    
    def _format_bug_context(self, hypothesis: BugHypothesis) -> str:
        """Format bug hypothesis into context for fix generation"""
        context = f"""
## Bug to Fix

**Title**: {hypothesis.title}

**Description**: {hypothesis.description}

**Root Cause**: {hypothesis.root_cause}

**Severity**: {hypothesis.severity.value}
**Category**: {hypothesis.category.value}

## Affected Files
"""
        
        for filepath in hypothesis.affected_files:
            context += f"\n### `{filepath}`\n"
            
            # Load file content
            full_path = self.repo_path / "ui" / filepath
            if full_path.exists():
                content = full_path.read_text()
                # Truncate if too long
                if len(content) > 10000:
                    content = content[:10000] + "\n... [truncated]"
                context += f"```typescript\n{content}\n```\n"
            else:
                context += "_File not found_\n"
        
        context += "\n## Suggested Fix Approach\n"
        if hypothesis.suggested_fix:
            context += hypothesis.suggested_fix
        else:
            context += "No specific approach suggested. Analyze the code and determine the best fix."
        
        return context
    
    async def generate_fix(self, hypothesis: BugHypothesis) -> List[CodeFix]:
        """
        Generate code fixes for a bug hypothesis.
        
        Args:
            hypothesis: The bug hypothesis with root cause analysis
        
        Returns:
            List of CodeFix objects for each file to modify
        """
        logger.info("generating_fix", title=hypothesis.title)
        
        context = self._format_bug_context(hypothesis)
        
        # Define tool handler for exploring code
        async def tool_handler(tool_name: str, tool_input: dict) -> str:
            if tool_name == "read_file":
                path = self.repo_path / "ui" / tool_input["path"]
                if path.exists():
                    content = path.read_text()
                    return content[:15000]  # Limit size
                return f"File not found: {tool_input['path']}"
            
            elif tool_name == "search_codebase":
                import subprocess
                try:
                    pattern = tool_input.get("file_pattern", "*.tsx")
                    result = subprocess.run(
                        ["grep", "-r", "-n", tool_input["query"], 
                         "--include", pattern],
                        cwd=self.repo_path / "ui",
                        capture_output=True,
                        text=True,
                        timeout=10,
                    )
                    return result.stdout[:5000] or "No matches found"
                except Exception as e:
                    return f"Search error: {e}"
            
            elif tool_name == "list_directory":
                path = self.repo_path / "ui" / tool_input["path"]
                if path.exists() and path.is_dir():
                    files = list(path.iterdir())[:50]
                    return "\n".join(f.name for f in files)
                return f"Directory not found: {tool_input['path']}"
            
            return f"Unknown tool: {tool_name}"
        
        try:
            response = await self.claude.analyze(
                system_prompt=FIX_GENERATION_PROMPT,
                user_message=context,
                use_tools=True,
                tool_handler=tool_handler,
            )
            
            # Parse response
            fixes = self._parse_fixes(response)
            
            if not fixes:
                logger.warning("no_fixes_generated")
                return []
            
            # Validate fixes
            valid_fixes = []
            for fix_data in fixes:
                fix = self._validate_fix(fix_data)
                if fix:
                    valid_fixes.append(fix)
            
            logger.info("fixes_generated", count=len(valid_fixes))
            return valid_fixes
            
        except Exception as e:
            logger.error("fix_generation_failed", error=str(e))
            return []
    
    def _parse_fixes(self, response: str) -> List[dict]:
        """Parse fix data from Claude response"""
        try:
            # Find JSON in response
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                data = json.loads(json_str)
                return data.get("fixes", [])
        except json.JSONDecodeError as e:
            logger.warning("json_parse_error", error=str(e))
        
        return []
    
    def _validate_fix(self, fix_data: dict) -> Optional[CodeFix]:
        """Validate a fix and ensure it can be applied"""
        file_path = fix_data.get("file_path", "")
        old_content = fix_data.get("old_content", "")
        new_content = fix_data.get("new_content", "")
        description = fix_data.get("description", "")
        
        if not all([file_path, old_content, new_content]):
            return None
        
        # Check file exists
        full_path = self.repo_path / "ui" / file_path
        if not full_path.exists():
            logger.warning("file_not_found", path=file_path)
            return None
        
        # Check old content exists in file
        current_content = full_path.read_text()
        if old_content not in current_content:
            logger.warning(
                "old_content_not_found",
                path=file_path,
                old_content_preview=old_content[:100]
            )
            return None
        
        return CodeFix(
            file_path=file_path,
            original_content=old_content,
            fixed_content=new_content,
            description=description,
        )
    
    async def apply_fixes(self, fixes: List[CodeFix]) -> None:
        """
        Apply fixes to the repository files.
        
        Args:
            fixes: List of CodeFix objects to apply
        """
        for fix in fixes:
            full_path = self.repo_path / "ui" / fix.file_path
            
            if not full_path.exists():
                logger.warning("cannot_apply_fix", path=fix.file_path)
                continue
            
            content = full_path.read_text()
            new_content = content.replace(fix.original_content, fix.fixed_content, 1)
            full_path.write_text(new_content)
            
            logger.info("fix_applied", path=fix.file_path)
    
    async def revert_fixes(self, fixes: List[CodeFix]) -> None:
        """
        Revert applied fixes.
        
        Args:
            fixes: List of CodeFix objects to revert
        """
        for fix in fixes:
            full_path = self.repo_path / "ui" / fix.file_path
            
            if not full_path.exists():
                continue
            
            content = full_path.read_text()
            reverted_content = content.replace(fix.fixed_content, fix.original_content, 1)
            full_path.write_text(reverted_content)
            
            logger.info("fix_reverted", path=fix.file_path)
    
    async def create_test_for_fix(self, fix: CodeFix, hypothesis: BugHypothesis) -> Optional[str]:
        """
        Generate a test case for a fix.
        
        Args:
            fix: The code fix
            hypothesis: The bug hypothesis
        
        Returns:
            Test code as a string, or None if generation fails
        """
        prompt = f"""Generate a Playwright test that verifies this bug fix.

## Bug Fixed
{hypothesis.title}

## Fix Applied
File: {fix.file_path}
Description: {fix.description}

## Requirements
- Use Playwright Test syntax
- Test the specific behavior that was fixed
- Include both positive (fix works) and negative (bug doesn't recur) assertions
- Keep the test focused and minimal

Return only the test code, no explanation.
"""
        
        try:
            response = await self.claude.analyze(
                system_prompt="You are a test engineer writing Playwright tests.",
                user_message=prompt,
            )
            return response
        except Exception as e:
            logger.error("test_generation_failed", error=str(e))
            return None
