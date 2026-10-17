#!/usr/bin/env python3
"""Unit tests for FleetOrchestrator."""

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

from fleet_orchestrator import FleetOrchestrator, SCHEMA_VERSION


def test_fleet_orchestrator_initialization():
    orch = FleetOrchestrator()
    assert orch.github_agent is not None
    assert orch.grok_agent is not None
    assert orch.cf_agent is not None
    assert orch.deepseek_agent is not None
    assert orch.crypto_agent is not None


def test_fleet_orchestrator_sweep_dry_run(tmp_path: Path):
    orch = FleetOrchestrator()
    receipt = orch.execute_fleet_sweep(dry_run=True, probe_edge=False, export_desktop=False)

    assert receipt["schema"] == SCHEMA_VERSION
    assert receipt["agents_tracked"] == 7
    assert receipt["agents_online"] == 7
    assert "master_sweep_sha256" in receipt
    assert len(receipt["master_sweep_sha256"]) == 64

    # Verify agent sub-reports
    agents = receipt["agents"]
    assert "github_sentinel" in agents
    assert "cloudflare_edge_ops" in agents
    assert "grok_orchestrator" in agents
    assert "deepseek_researcher" in agents
    assert "crypto_asset_banker" in agents

    assert agents["github_sentinel"]["status"] == "online"
    assert agents["cloudflare_edge_ops"]["status"] == "online"
    assert agents["grok_orchestrator"]["status"] == "online"
    assert agents["deepseek_researcher"]["status"] == "online"
    assert agents["crypto_asset_banker"]["status"] == "online"
