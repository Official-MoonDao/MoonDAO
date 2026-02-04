"""
Data models for the bug detection agent
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import datetime


class AgentState(str, Enum):
    """States in the bug detection workflow"""
    IDLE = "idle"
    SCANNING = "scanning"
    TESTING = "testing"
    ANALYZING = "analyzing"
    REPORTING = "reporting"
    WAITING_CONFIRMATION = "waiting_confirmation"
    FIXING = "fixing"
    REVIEWING = "reviewing"
    TESTING_FIX = "testing_fix"
    CREATING_PR = "creating_pr"
    COMPLETED = "completed"
    FAILED = "failed"


class BugSeverity(str, Enum):
    """Bug severity levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class BugCategory(str, Enum):
    """Categories of bugs"""
    CRASH = "crash"
    FUNCTIONAL = "functional"
    VISUAL = "visual"
    PERFORMANCE = "performance"
    ACCESSIBILITY = "accessibility"
    SECURITY = "security"
    RESPONSIVE = "responsive"
    WALLET = "wallet"
    API = "api"


class ConsoleMessage(BaseModel):
    """Captured console message from browser"""
    type: str  # error, warning, log, etc.
    text: str
    location: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class NetworkRequest(BaseModel):
    """Captured network request details"""
    url: str
    method: str
    status: Optional[int] = None
    timing: Optional[float] = None
    failed: bool = False
    error: Optional[str] = None


class TestFailure(BaseModel):
    """Details of a test failure"""
    test_name: str
    test_file: str
    browser: str
    viewport: str
    error_message: str
    screenshot_path: Optional[str] = None
    video_path: Optional[str] = None
    console_logs: List[ConsoleMessage] = []
    network_logs: List[NetworkRequest] = []
    dom_snapshot: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class BugHypothesis(BaseModel):
    """AI-generated hypothesis about a bug"""
    title: str
    description: str
    severity: BugSeverity
    category: BugCategory
    confidence: float = Field(ge=0.0, le=1.0)
    
    # Root cause analysis
    root_cause: str
    affected_files: List[str] = []
    affected_components: List[str] = []
    
    # Reproduction
    reproduction_steps: List[str] = []
    affected_browsers: List[str] = []
    affected_viewports: List[str] = []
    
    # Evidence
    test_failures: List[TestFailure] = []
    
    # Potential fixes
    suggested_fix: Optional[str] = None
    related_issues: List[str] = []
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    analyzed_by: str = "claude"


class CodeFix(BaseModel):
    """A proposed code fix"""
    file_path: str
    original_content: str
    fixed_content: str
    description: str
    
    # Review status
    linting_passed: bool = False
    tests_passed: bool = False
    self_review_notes: List[str] = []


class BugReport(BaseModel):
    """Complete bug report for GitHub issue"""
    hypothesis: BugHypothesis
    
    # GitHub integration
    issue_number: Optional[int] = None
    issue_url: Optional[str] = None
    pr_number: Optional[int] = None
    pr_url: Optional[str] = None
    
    # State tracking
    state: AgentState = AgentState.REPORTING
    confirmed: bool = False
    fixed: bool = False
    
    # Fixes
    proposed_fixes: List[CodeFix] = []
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class TestResult(BaseModel):
    """Result of a test run"""
    passed: bool
    total_tests: int
    passed_tests: int
    failed_tests: int
    skipped_tests: int
    duration_ms: float
    failures: List[TestFailure] = []
    report_path: Optional[str] = None


class ScanResult(BaseModel):
    """Result of repository scanning"""
    has_changes: bool
    changed_files: List[str] = []
    new_commits: List[str] = []
    last_scanned_commit: Optional[str] = None
    current_commit: str
