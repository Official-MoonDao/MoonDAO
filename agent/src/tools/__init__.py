"""
Tools for interacting with external services
"""

from .claude import ClaudeClient
from .github import GitHubClient

__all__ = ["ClaudeClient", "GitHubClient"]
