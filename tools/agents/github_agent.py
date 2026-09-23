#!/usr/bin/env python3
"""Autonomous GitHub Sentinel Agent for repository health, CI monitoring, and PR/issue triage.

Operates fail-closed: read-only audits and triage reports by default;
dispatches remote workflow events only when explicitly commanded.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Any, Dict, List, Optional


SCHEMA_VERSION = "northstar.github_agent.report.v1"
DEFAULT_REPO_SLUG = "andrewwhitecog-tech/northstarprime-always-on"


class GitHubAgent:
    """Agent driving git and GitHub CLI for repository intelligence and triage."""

    def __init__(self, repo_path: Optional[Path] = None, repo_slug: str = DEFAULT_REPO_SLUG):
        self.repo_path = repo_path.resolve() if repo_path else Path(__file__).resolve().parent.parent.parent
        self.repo_slug = repo_slug
        self.gh_binary = shutil.which("gh")
        self.git_binary = shutil.which("git")

    def _run_cmd(self, cmd: List[str], cwd: Optional[Path] = None) -> subprocess.CompletedProcess:
        return subprocess.run(
            cmd,
            cwd=str(cwd or self.repo_path),
            capture_output=True,
            text=True,
            check=False,
        )

    def audit_git_working_tree(self) -> Dict[str, Any]:
        """Audit local git repository state."""
        if not self.git_binary:
            return {"error": "git executable not found on PATH"}

        is_git = self._run_cmd([self.git_binary, "rev-parse", "--is-inside-work-tree"])
        if is_git.returncode != 0:
            return {"error": "target path is not a git working tree", "path": str(self.repo_path)}

        branch = self._run_cmd([self.git_binary, "branch", "--show-current"]).stdout.strip()
        commit_info = self._run_cmd(
            [self.git_binary, "log", "-1", "--format=%H|%s|%an|%ci"]
        ).stdout.strip().split("|")

        status_raw = self._run_cmd([self.git_binary, "status", "--porcelain"]).stdout
        dirty_lines = [line.strip() for line in status_raw.splitlines() if line.strip()]

        staged = [l for l in dirty_lines if l and l[0] in "MADRC"]
        unstaged = [l for l in dirty_lines if len(l) > 1 and l[1] in "MD"]
        untracked = [l for l in dirty_lines if l.startswith("??")]

        # Head divergence with upstream
        divergence = self._run_cmd([self.git_binary, "status", "-sb"]).stdout.strip().splitlines()
        branch_header = divergence[0] if divergence else ""

        return {
            "status": "clean" if not dirty_lines else "dirty",
            "branch": branch,
            "branch_summary": branch_header,
            "head_commit": {
                "sha": commit_info[0] if len(commit_info) > 0 else "unknown",
                "message": commit_info[1] if len(commit_info) > 1 else "",
                "author": commit_info[2] if len(commit_info) > 2 else "",
                "date": commit_info[3] if len(commit_info) > 3 else "",
            },
            "dirty_count": len(dirty_lines),
            "staged_count": len(staged),
            "unstaged_count": len(unstaged),
            "untracked_count": len(untracked),
            "untracked_samples": untracked[:10],
            "staged_samples": staged[:10],
        }

    def check_gh_auth(self) -> Dict[str, Any]:
        """Check if gh CLI is authenticated."""
        if not self.gh_binary:
            return {"authenticated": False, "error": "gh executable not found"}
        res = self._run_cmd([self.gh_binary, "auth", "status"])
        auth_output = res.stderr or res.stdout
        return {
            "authenticated": (res.returncode == 0),
            "output_summary": auth_output.strip().splitlines()[:5],
        }

    def triage_issues(self, limit: int = 15) -> Dict[str, Any]:
        """Fetch and prioritize open issues."""
        if not self.gh_binary:
            return {"error": "gh CLI not available"}

        cmd = [
            self.gh_binary,
            "issue",
            "list",
            "--repo",
            self.repo_slug,
            "--limit",
            str(limit),
            "--json",
            "number,title,author,labels,updatedAt,comments",
        ]
        res = self._run_cmd(cmd)
        if res.returncode != 0:
            return {"error": res.stderr.strip() or "failed to list issues", "issues": []}

        try:
            raw_issues = json.loads(res.stdout)
        except json.JSONDecodeError:
            return {"error": "invalid json from gh issue list", "issues": []}

        triaged = []
        for issue in raw_issues:
            labels = [lbl.get("name", "") for lbl in issue.get("labels", [])]
            priority = "low"
            if any("bug" in l.lower() or "critical" in l.lower() for l in labels):
                priority = "critical"
            elif any("enhancement" in l.lower() or "feature" in l.lower() for l in labels):
                priority = "medium"

            triaged.append({
                "number": issue.get("number"),
                "title": issue.get("title"),
                "author": issue.get("author", {}).get("login"),
                "labels": labels,
                "priority_assessment": priority,
                "updated_at": issue.get("updatedAt"),
            })

        return {"count": len(triaged), "issues": triaged}

    def triage_pull_requests(self, limit: int = 10) -> Dict[str, Any]:
        """Fetch and audit open pull requests."""
        if not self.gh_binary:
            return {"error": "gh CLI not available"}

        cmd = [
            self.gh_binary,
            "pr",
            "list",
            "--repo",
            self.repo_slug,
            "--limit",
            str(limit),
            "--json",
            "number,title,author,labels,isDraft,headRefName,updatedAt",
        ]
        res = self._run_cmd(cmd)
        if res.returncode != 0:
            return {"error": res.stderr.strip() or "failed to list PRs", "prs": []}

        try:
            prs = json.loads(res.stdout)
        except json.JSONDecodeError:
            return {"error": "invalid json from gh pr list", "prs": []}

        return {"count": len(prs), "pull_requests": prs}

    def ci_health_monitor(self, limit: int = 10) -> Dict[str, Any]:
        """Check status of latest workflow runs."""
        if not self.gh_binary:
            return {"error": "gh CLI not available"}

        cmd = [
            self.gh_binary,
            "run",
            "list",
            "--repo",
            self.repo_slug,
            "--limit",
            str(limit),
            "--json",
            "databaseId,name,status,conclusion,workflowName,createdAt,url",
        ]
        res = self._run_cmd(cmd)
        if res.returncode != 0:
            return {"error": res.stderr.strip() or "failed to list runs", "runs": []}

        try:
            runs = json.loads(res.stdout)
        except json.JSONDecodeError:
            return {"error": "invalid json from gh run list", "runs": []}

        failing = [r for r in runs if r.get("conclusion") in {"failure", "startup_failure"}]
        in_progress = [r for r in runs if r.get("status") in {"in_progress", "queued"}]
        successful = [r for r in runs if r.get("conclusion") == "success"]

        return {
            "total_inspected": len(runs),
            "failing_count": len(failing),
            "in_progress_count": len(in_progress),
            "successful_count": len(successful),
            "latest_run": runs[0] if runs else None,
            "failing_runs": failing,
        }

    def generate_full_report(self) -> Dict[str, Any]:
        """Aggregate full repository, triage, and CI health audit into a verifiable receipt."""
        timestamp = datetime.now(timezone.utc).isoformat()
        git_state = self.audit_git_working_tree()
        auth_state = self.check_gh_auth()
        issues_state = self.triage_issues()
        prs_state = self.triage_pull_requests()
        ci_state = self.ci_health_monitor()

        report_payload = {
            "schema": SCHEMA_VERSION,
            "timestamp_utc": timestamp,
            "repo_path": str(self.repo_path),
            "repo_slug": self.repo_slug,
            "git_state": git_state,
            "auth_state": auth_state,
            "triage": {
                "issues": issues_state,
                "pull_requests": prs_state,
            },
            "ci_health": ci_state,
        }

        # Cryptographic receipt
        serialized = json.dumps(report_payload, sort_keys=True, indent=2)
        digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        report_payload["receipt_sha256"] = digest

        return report_payload


def main() -> int:
    parser = argparse.ArgumentParser(description="NorthStar Autonomous GitHub Sentinel Agent")
    parser.add_argument("--repo-path", type=str, default="", help="Path to local git repo")
    parser.add_argument("--repo-slug", type=str, default=DEFAULT_REPO_SLUG, help="GitHub owner/repo slug")
    parser.add_argument("--output", type=str, default="", help="Path to save JSON audit report")
    parser.add_argument("--markdown", action="store_true", help="Output human-readable markdown summary")
    args = parser.parse_args()

    repo_path = Path(args.repo_path).resolve() if args.repo_path else None
    agent = GitHubAgent(repo_path=repo_path, repo_slug=args.repo_slug)
    report = agent.generate_full_report()

    if args.output:
        out_path = Path(args.output).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"Receipt written to {out_path} (SHA-256: {report['receipt_sha256'][:16]}...)")

    if args.markdown or not args.output:
        print("# NorthStar GitHub Sentinel Audit Report")
        print(f"- **Timestamp**: `{report['timestamp_utc']}`")
        print(f"- **Repo**: `{report['repo_slug']}` (Local: `{report['repo_path']}`)")
        print(f"- **Git Status**: `{report['git_state'].get('status')}` (Branch: `{report['git_state'].get('branch')}`)")
        print(f"- **Open Issues**: {report['triage']['issues'].get('count', 0)}")
        print(f"- **Open PRs**: {report['triage']['pull_requests'].get('count', 0)}")
        ci = report['ci_health']
        print(f"- **CI Status**: {ci.get('successful_count', 0)} succeeded, {ci.get('failing_count', 0)} failing, {ci.get('in_progress_count', 0)} active")
        print(f"- **Receipt SHA-256**: `{report['receipt_sha256']}`")

    return 0


if __name__ == "__main__":
    sys.exit(main())
