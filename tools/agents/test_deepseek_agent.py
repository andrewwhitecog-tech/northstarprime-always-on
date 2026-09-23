#!/usr/bin/env python3
"""Unit tests for DeepSeekAgent."""

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

from deepseek_agent import DeepSeekAgent, SCHEMA_VERSION, TASK_PROFILES


def test_build_prompt():
    agent = DeepSeekAgent()
    prompt = agent.build_prompt("quant_reasoning", "Calculate optimal drawdown allocation.")
    assert "quantitative reasoning specialist" in prompt
    assert "Calculate optimal drawdown allocation." in prompt


def test_run_reasoning_dry_run(tmp_path: Path):
    agent = DeepSeekAgent(receipt_root=tmp_path)
    receipt = agent.run_reasoning(
        prompt="Audit state machine for race conditions.",
        profile="deep_architectural_audit",
        dry_run=True,
    )

    assert receipt["schema"] == SCHEMA_VERSION
    assert receipt["status"] == "dry_run_success"
    assert receipt["profile"] == "deep_architectural_audit"
    assert receipt["model"] == "deepseek-r1"
    assert "receipt_sha256" in receipt
    assert len(receipt["receipt_sha256"]) == 64
    assert receipt["reasoning_snippet"] is not None
    assert "THINK TRACE" in receipt["reasoning_snippet"]


def test_run_reasoning_adversarial_offline(tmp_path: Path):
    agent = DeepSeekAgent(receipt_root=tmp_path)
    receipt = agent.run_reasoning(
        prompt="Verify fail-closed bounds.",
        profile="adversarial_logic_stress_test",
        dry_run=False,  # Without API key, falls back to simulated offline
    )
    assert receipt["status"] == "simulated_offline_success"
    assert len(receipt["receipt_sha256"]) == 64
