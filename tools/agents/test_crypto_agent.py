#!/usr/bin/env python3
"""Unit tests for CryptoAgent."""

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

from crypto_agent import CryptoAgent, SCHEMA_VERSION, MAX_FRACTIONAL_CAP


def test_crypto_portfolio_audit():
    agent = CryptoAgent()
    portfolio = agent.audit_portfolio()
    assert portfolio["execution_mode"] == "READ_ONLY"
    assert "platforms" in portfolio
    assert "SpaceCash_Treasury" in portfolio["platforms"]
    assert portfolio["total_portfolio_equity"] > 0


def test_fractional_kelly_positive_edge():
    agent = CryptoAgent()
    # Market price: 0.40, model probability: 0.60, bankroll: $1,000
    calc = agent.compute_fractional_kelly(
        contract_id="TEST-ASSET",
        market_price=0.40,
        model_probability=0.60,
        bankroll=1000.0,
    )
    assert calc["edge"] > 0
    assert calc["action"] == "STAKE_RECOMMENDED"
    # Quarter Kelly capped at MAX_FRACTIONAL_CAP (5%) -> max stake $50
    assert calc["recommended_stake_usd"] <= 1000.0 * MAX_FRACTIONAL_CAP
    assert calc["risk_guard"] == "CAPPED_QUARTER_KELLY_5PCT_MAX"


def test_fractional_kelly_negative_edge():
    agent = CryptoAgent()
    # Market price: 0.70, model probability: 0.50 (negative edge)
    calc = agent.compute_fractional_kelly(
        contract_id="TEST-ASSET-NEG",
        market_price=0.70,
        model_probability=0.50,
        bankroll=1000.0,
    )
    assert calc["edge"] < 0
    assert calc["action"] == "NO_STAKE_NEGATIVE_EDGE"
    assert calc["recommended_stake_usd"] == 0.0


def test_generate_report_and_safety_invariants(tmp_path: Path):
    agent = CryptoAgent(receipt_root=tmp_path)
    report = agent.generate_report(
        contract_id="KX-PROB-01",
        market_price=0.45,
        model_prob=0.55,
        bankroll=500.0,
    )
    assert report["schema"] == SCHEMA_VERSION
    assert "receipt_hash" in report
    assert len(report["receipt_hash"]) == 64
    assert report["safety_invariants"]["zero_live_financial_transactions"] is True
    assert report["safety_invariants"]["zero_credential_mutations"] is True
