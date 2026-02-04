"""
Tests for data models
"""

import pytest
from datetime import datetime

from src.models import (
    AgentState,
    BugSeverity,
    BugCategory,
    BugHypothesis,
    TestFailure,
    BugReport,
    CodeFix,
)


class TestAgentState:
    def test_all_states_defined(self):
        """Verify all expected states exist"""
        expected_states = [
            "idle", "scanning", "testing", "analyzing", "reporting",
            "waiting_confirmation", "fixing", "reviewing", "testing_fix",
            "creating_pr", "completed", "failed"
        ]
        
        actual_states = [s.value for s in AgentState]
        assert set(expected_states) == set(actual_states)


class TestBugHypothesis:
    def test_create_valid_hypothesis(self):
        """Test creating a valid bug hypothesis"""
        hypothesis = BugHypothesis(
            title="Test Bug",
            description="A test bug description",
            severity=BugSeverity.MEDIUM,
            category=BugCategory.FUNCTIONAL,
            confidence=0.85,
            root_cause="Test root cause",
            affected_files=["components/Test.tsx"],
            reproduction_steps=["Step 1", "Step 2"],
        )
        
        assert hypothesis.title == "Test Bug"
        assert hypothesis.confidence == 0.85
        assert hypothesis.severity == BugSeverity.MEDIUM
    
    def test_confidence_validation(self):
        """Test confidence must be between 0 and 1"""
        with pytest.raises(ValueError):
            BugHypothesis(
                title="Test",
                description="Test",
                severity=BugSeverity.LOW,
                category=BugCategory.VISUAL,
                confidence=1.5,  # Invalid
                root_cause="Test",
            )


class TestTestFailure:
    def test_create_test_failure(self):
        """Test creating a test failure record"""
        failure = TestFailure(
            test_name="should load homepage",
            test_file="tests/home.spec.ts",
            browser="chromium",
            viewport="desktop",
            error_message="Element not found",
        )
        
        assert failure.test_name == "should load homepage"
        assert failure.browser == "chromium"
        assert failure.console_logs == []
        assert failure.timestamp is not None


class TestBugReport:
    def test_create_bug_report(self):
        """Test creating a bug report"""
        hypothesis = BugHypothesis(
            title="Test Bug",
            description="Description",
            severity=BugSeverity.HIGH,
            category=BugCategory.CRASH,
            confidence=0.9,
            root_cause="Root cause",
        )
        
        report = BugReport(hypothesis=hypothesis)
        
        assert report.hypothesis == hypothesis
        assert report.state == AgentState.REPORTING
        assert report.confirmed is False
        assert report.fixed is False


class TestCodeFix:
    def test_create_code_fix(self):
        """Test creating a code fix"""
        fix = CodeFix(
            file_path="components/Test.tsx",
            original_content="const x = null.value",
            fixed_content="const x = null?.value",
            description="Add optional chaining",
        )
        
        assert fix.file_path == "components/Test.tsx"
        assert fix.linting_passed is False
        assert fix.tests_passed is False
