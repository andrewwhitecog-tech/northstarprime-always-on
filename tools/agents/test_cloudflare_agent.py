#!/usr/bin/env python3
"""Unit tests for CloudflareAgent."""

import json
from pathlib import Path
import sys
import pytest

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from cloudflare_agent import CloudflareAgent, RELEASE_GUARD_BYTES, FILE_LIMIT_BYTES


def test_audit_missing_artifact(tmp_path: Path):
    agent = CloudflareAgent(repo_path=tmp_path)
    res = agent.audit_release_budget(tmp_path / "nonexistent")
    assert res["status"] == "missing_artifact"
    assert "does not exist" in res["error"]


def test_audit_release_budget_within_limit(tmp_path: Path):
    mock_artifact = tmp_path / "pages-artifact"
    mock_artifact.mkdir()
    (mock_artifact / "index.html").write_text("<html>hello</html>", encoding="utf-8")
    (mock_artifact / "style.css").write_text("body { color: black; }", encoding="utf-8")

    agent = CloudflareAgent(repo_path=tmp_path)
    res = agent.audit_release_budget(mock_artifact)

    assert res["status"] == "ok"
    assert res["file_count"] == 2
    assert res["passed_guard"] is True
    assert res["oversized_count"] == 0
    assert res["headroom_bytes"] > 0
    assert len(res["largest_files"]) == 2


def test_edge_availability_dry_run():
    agent = CloudflareAgent()
    probes = agent.audit_edge_availability(endpoints=["https://northstarprime.pages.dev"], dry_run=True)
    assert len(probes) == 1
    assert probes[0]["reachable"] is True
    assert probes[0]["dry_run"] is True


def test_generate_report_and_receipt(tmp_path: Path):
    mock_artifact = tmp_path / "output" / "pages-artifact"
    mock_artifact.mkdir(parents=True)
    (mock_artifact / "index.html").write_text("<h1>NorthStar</h1>", encoding="utf-8")

    agent = CloudflareAgent(repo_path=tmp_path)
    report = agent.generate_report(target_path=mock_artifact, probe_edge=True, dry_run=True)

    assert "schema" in report
    assert "receipt_hash" in report
    assert len(report["receipt_hash"]) == 64
    assert report["deployment_readiness"]["deployment_ready"] is True
    assert len(report["edge_probes"]) > 0

    markdown = agent.format_markdown(report)
    assert "READY FOR RELEASE" in markdown
    assert report["receipt_hash"] in markdown
