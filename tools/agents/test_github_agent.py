#!/usr/bin/env python3
"""Unit tests for GitHubAgent."""

import json
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

from tools.agents.github_agent import GitHubAgent, SCHEMA_VERSION


class TestGitHubAgent(unittest.TestCase):
    def setUp(self):
        self.agent = GitHubAgent()

    def test_schema_and_initialization(self):
        self.assertIsNotNone(self.agent.repo_path)
        self.assertTrue(self.agent.repo_path.exists())
        self.assertEqual(self.agent.repo_slug, "andrewwhitecog-tech/northstarprime-always-on")

    def test_audit_git_working_tree_real(self):
        res = self.agent.audit_git_working_tree()
        self.assertNotIn("error", res)
        self.assertIn("status", res)
        self.assertIn("branch", res)
        self.assertIn("head_commit", res)
        self.assertIn("sha", res["head_commit"])

    def test_check_gh_auth_real(self):
        res = self.agent.check_gh_auth()
        self.assertIn("authenticated", res)

    @patch("subprocess.run")
    def test_triage_issues_mocked(self, mock_run):
        mock_output = [
            {"number": 1, "title": "Critical bug in scanner", "author": {"login": "testuser"}, "labels": [{"name": "bug"}], "updatedAt": "2026-09-22T00:00:00Z"},
            {"number": 2, "title": "Feature request", "author": {"login": "testuser2"}, "labels": [{"name": "enhancement"}], "updatedAt": "2026-09-22T00:00:00Z"}
        ]
        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.stdout = json.dumps(mock_output)
        mock_proc.stderr = ""
        mock_run.return_value = mock_proc

        res = self.agent.triage_issues()
        self.assertEqual(res["count"], 2)
        self.assertEqual(res["issues"][0]["priority_assessment"], "critical")
        self.assertEqual(res["issues"][1]["priority_assessment"], "medium")

    def test_generate_full_report_integrity(self):
        report = self.agent.generate_full_report()
        self.assertEqual(report["schema"], SCHEMA_VERSION)
        self.assertIn("receipt_sha256", report)
        self.assertEqual(len(report["receipt_sha256"]), 64)
        self.assertIn("git_state", report)
        self.assertIn("ci_health", report)


if __name__ == "__main__":
    unittest.main()
