"""
Configuration management for the bug detection agent
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    """Agent configuration loaded from environment variables"""
    
    # API Keys
    anthropic_api_key: str = Field(..., env="ANTHROPIC_API_KEY")
    github_token: str = Field(..., env="GITHUB_TOKEN")
    
    # GitHub Configuration
    github_repository: str = Field(
        default="Official-MoonDao/MoonDAO",
        env="GITHUB_REPOSITORY"
    )
    github_base_branch: str = Field(default="main", env="GITHUB_BASE_BRANCH")
    
    # Agent Configuration
    base_url: str = Field(default="http://localhost:3000", env="BASE_URL")
    repo_path: Path = Field(default=Path("/repo"), env="REPO_PATH")
    results_path: Path = Field(default=Path("/app/results"), env="RESULTS_PATH")
    reports_path: Path = Field(default=Path("/app/reports"), env="REPORTS_PATH")
    
    # Claude Configuration
    claude_model: str = Field(default="claude-sonnet-4-20250514", env="CLAUDE_MODEL")
    claude_max_tokens: int = Field(default=4096, env="CLAUDE_MAX_TOKENS")
    
    # Testing Configuration
    playwright_timeout: int = Field(default=30000, env="PLAYWRIGHT_TIMEOUT")
    max_retries: int = Field(default=3, env="MAX_RETRIES")
    
    # Rate Limiting
    max_bugs_per_cycle: int = Field(default=5, env="MAX_BUGS_PER_CYCLE")
    max_api_calls_per_hour: int = Field(default=100, env="MAX_API_CALLS_PER_HOUR")
    
    # Labels for GitHub Issues
    label_agent_detected: str = "agent-detected"
    label_needs_confirmation: str = "needs-confirmation"
    label_confirmed: str = "agent-confirmed"
    label_fix_in_progress: str = "fix-in-progress"
    label_fix_ready: str = "fix-ready"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
