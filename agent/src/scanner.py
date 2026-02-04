"""
Repository scanner for detecting changes

Monitors the git repository for new commits and changed files
to trigger bug detection cycles.
"""

import subprocess
from pathlib import Path
from typing import Optional, List
import structlog

from .config import Settings
from .models import ScanResult

logger = structlog.get_logger()


class RepoScanner:
    """Scans the repository for changes since last run"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.repo_path = settings.repo_path
        self.state_file = settings.results_path / "last_scan.txt"
    
    def _run_git(self, *args: str) -> str:
        """Run a git command and return output"""
        result = subprocess.run(
            ["git", *args],
            cwd=self.repo_path,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    
    def _get_last_scanned_commit(self) -> Optional[str]:
        """Get the last commit that was scanned"""
        if self.state_file.exists():
            return self.state_file.read_text().strip()
        return None
    
    def _save_last_scanned_commit(self, commit: str) -> None:
        """Save the last scanned commit"""
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(commit)
    
    def _get_current_commit(self) -> str:
        """Get the current HEAD commit"""
        return self._run_git("rev-parse", "HEAD")
    
    def _get_changed_files(self, since_commit: str, until_commit: str) -> List[str]:
        """Get list of files changed between commits"""
        try:
            output = self._run_git(
                "diff", "--name-only",
                since_commit, until_commit
            )
            return [f for f in output.split("\n") if f]
        except subprocess.CalledProcessError:
            return []
    
    def _get_commits_between(self, since_commit: str, until_commit: str) -> List[str]:
        """Get list of commit hashes between two commits"""
        try:
            output = self._run_git(
                "rev-list",
                f"{since_commit}..{until_commit}"
            )
            return [c for c in output.split("\n") if c]
        except subprocess.CalledProcessError:
            return []
    
    def _is_relevant_file(self, filepath: str) -> bool:
        """Check if a changed file is relevant for testing"""
        # Focus on UI/app changes
        relevant_patterns = [
            "ui/components/",
            "ui/pages/",
            "ui/lib/",
            "ui/const/",
            "ui/styles/",
        ]
        
        # Ignore patterns
        ignore_patterns = [
            ".md",
            ".txt",
            ".json",  # Except for specific config files
            "test/",
            "spec/",
            ".cy.",   # Cypress tests
        ]
        
        # Check if file matches relevant patterns
        is_relevant = any(pattern in filepath for pattern in relevant_patterns)
        is_ignored = any(pattern in filepath for pattern in ignore_patterns)
        
        return is_relevant and not is_ignored
    
    async def scan(self) -> ScanResult:
        """
        Scan the repository for changes.
        
        Returns:
            ScanResult with information about changes since last scan
        """
        logger.info("scanning_repository", path=str(self.repo_path))
        
        current_commit = self._get_current_commit()
        last_commit = self._get_last_scanned_commit()
        
        if not last_commit:
            # First run - consider as no changes to avoid overwhelming
            logger.info("first_scan", commit=current_commit)
            self._save_last_scanned_commit(current_commit)
            return ScanResult(
                has_changes=False,
                current_commit=current_commit,
                last_scanned_commit=None,
            )
        
        if current_commit == last_commit:
            logger.info("no_new_commits")
            return ScanResult(
                has_changes=False,
                current_commit=current_commit,
                last_scanned_commit=last_commit,
            )
        
        # Get changes
        all_changed_files = self._get_changed_files(last_commit, current_commit)
        relevant_files = [f for f in all_changed_files if self._is_relevant_file(f)]
        new_commits = self._get_commits_between(last_commit, current_commit)
        
        # Update last scanned commit
        self._save_last_scanned_commit(current_commit)
        
        has_relevant_changes = len(relevant_files) > 0
        
        logger.info(
            "scan_complete",
            total_changed=len(all_changed_files),
            relevant_changed=len(relevant_files),
            new_commits=len(new_commits),
        )
        
        return ScanResult(
            has_changes=has_relevant_changes,
            changed_files=relevant_files,
            new_commits=new_commits,
            last_scanned_commit=last_commit,
            current_commit=current_commit,
        )
    
    async def get_file_content(self, filepath: str, commit: Optional[str] = None) -> str:
        """Get content of a file, optionally at a specific commit"""
        if commit:
            return self._run_git("show", f"{commit}:{filepath}")
        
        file_path = self.repo_path / filepath
        return file_path.read_text()
    
    async def get_file_diff(self, filepath: str, since_commit: str) -> str:
        """Get diff for a specific file since a commit"""
        try:
            return self._run_git("diff", since_commit, "--", filepath)
        except subprocess.CalledProcessError:
            return ""
