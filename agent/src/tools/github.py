"""
GitHub API client for issue and PR management

Handles creating bug reports, managing labels, and creating pull requests.
"""

from typing import List, Optional
import structlog
from github import Github, GithubException
from github.Issue import Issue
from github.PullRequest import PullRequest
from github.Repository import Repository

from ..config import Settings

logger = structlog.get_logger()


class GitHubClient:
    """Client for GitHub API operations"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.github = Github(settings.github_token)
        self._repo: Optional[Repository] = None
    
    @property
    def repo(self) -> Repository:
        """Get the repository object"""
        if self._repo is None:
            self._repo = self.github.get_repo(self.settings.github_repository)
        return self._repo
    
    async def create_issue(
        self,
        title: str,
        body: str,
        labels: Optional[List[str]] = None,
    ) -> Issue:
        """
        Create a new issue in the repository.
        
        Args:
            title: Issue title
            body: Issue body (markdown)
            labels: List of label names to apply
        
        Returns:
            Created Issue object
        """
        logger.info("creating_issue", title=title)
        
        # Ensure labels exist
        existing_labels = [l.name for l in self.repo.get_labels()]
        labels_to_apply = []
        
        for label in (labels or []):
            if label not in existing_labels:
                try:
                    self.repo.create_label(
                        name=label,
                        color="d73a4a" if "bug" in label else "0e8a16"
                    )
                except GithubException:
                    pass  # Label might already exist
            labels_to_apply.append(label)
        
        issue = self.repo.create_issue(
            title=title,
            body=body,
            labels=labels_to_apply,
        )
        
        logger.info("issue_created", number=issue.number, url=issue.html_url)
        return issue
    
    async def add_comment(self, issue_number: int, comment: str) -> None:
        """Add a comment to an issue"""
        issue = self.repo.get_issue(issue_number)
        issue.create_comment(comment)
        logger.info("comment_added", issue_number=issue_number)
    
    async def add_label(self, issue_number: int, label: str) -> None:
        """Add a label to an issue"""
        issue = self.repo.get_issue(issue_number)
        issue.add_to_labels(label)
        logger.info("label_added", issue_number=issue_number, label=label)
    
    async def remove_label(self, issue_number: int, label: str) -> None:
        """Remove a label from an issue"""
        issue = self.repo.get_issue(issue_number)
        try:
            issue.remove_from_labels(label)
            logger.info("label_removed", issue_number=issue_number, label=label)
        except GithubException:
            pass  # Label might not exist on issue
    
    async def get_issues_with_label(self, label: str) -> List[Issue]:
        """Get all open issues with a specific label"""
        return list(self.repo.get_issues(state="open", labels=[label]))
    
    async def create_branch(self, branch_name: str, base_branch: Optional[str] = None) -> str:
        """
        Create a new branch from base branch.
        
        Args:
            branch_name: Name for the new branch
            base_branch: Branch to create from (default: main)
        
        Returns:
            Full ref name of created branch
        """
        base = base_branch or self.settings.github_base_branch
        base_ref = self.repo.get_git_ref(f"heads/{base}")
        
        ref_name = f"refs/heads/{branch_name}"
        
        try:
            self.repo.create_git_ref(
                ref=ref_name,
                sha=base_ref.object.sha
            )
            logger.info("branch_created", branch=branch_name)
        except GithubException as e:
            if e.status == 422:  # Already exists
                logger.info("branch_exists", branch=branch_name)
            else:
                raise
        
        return ref_name
    
    async def update_file(
        self,
        path: str,
        content: str,
        message: str,
        branch: str,
    ) -> None:
        """
        Update a file in the repository.
        
        Args:
            path: File path relative to repo root
            content: New file content
            message: Commit message
            branch: Branch to commit to
        """
        try:
            # Get current file to get its SHA
            current_file = self.repo.get_contents(path, ref=branch)
            sha = current_file.sha
            
            self.repo.update_file(
                path=path,
                message=message,
                content=content,
                sha=sha,
                branch=branch,
            )
        except GithubException as e:
            if e.status == 404:
                # File doesn't exist, create it
                self.repo.create_file(
                    path=path,
                    message=message,
                    content=content,
                    branch=branch,
                )
            else:
                raise
        
        logger.info("file_updated", path=path, branch=branch)
    
    async def create_pull_request(
        self,
        title: str,
        body: str,
        head_branch: str,
        base_branch: Optional[str] = None,
        labels: Optional[List[str]] = None,
    ) -> PullRequest:
        """
        Create a pull request.
        
        Args:
            title: PR title
            body: PR body (markdown)
            head_branch: Branch with changes
            base_branch: Target branch (default: main)
            labels: Labels to apply
        
        Returns:
            Created PullRequest object
        """
        base = base_branch or self.settings.github_base_branch
        
        pr = self.repo.create_pull(
            title=title,
            body=body,
            head=head_branch,
            base=base,
        )
        
        if labels:
            pr.add_to_labels(*labels)
        
        logger.info("pr_created", number=pr.number, url=pr.html_url)
        return pr
    
    async def get_file_content(self, path: str, ref: Optional[str] = None) -> str:
        """Get content of a file from the repository"""
        ref = ref or self.settings.github_base_branch
        content = self.repo.get_contents(path, ref=ref)
        return content.decoded_content.decode("utf-8")
    
    async def search_code(self, query: str, path: Optional[str] = None) -> List[str]:
        """
        Search for code in the repository.
        
        Args:
            query: Search query
            path: Optional path to limit search
        
        Returns:
            List of file paths matching the query
        """
        search_query = f"{query} repo:{self.settings.github_repository}"
        if path:
            search_query += f" path:{path}"
        
        results = self.github.search_code(search_query)
        return [r.path for r in results]
