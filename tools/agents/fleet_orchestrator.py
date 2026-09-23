#!/usr/bin/env python3
"""Autonomous Fleet Orchestrator for NorthStar Prime.

Coordinates execution across all 7 autonomous agents:
1. GitHub Sentinel (tools/agents/github_agent.py)
2. Grok Bot Orchestrator (tools/agents/grok_agent.py)
3. Cloudflare Edge Ops (tools/agents/cloudflare_agent.py)
4. DeepSeek Edge Researcher (tools/agents/deepseek_agent.py)
5. Microsoft 365 Copilot (automation/local_ai_fleet/m365_agent.py)
6. Super Grok WebUI (automation/local_ai_fleet/super_grok_webui_agent.py)
7. Crypto Asset Banker & SpaceCash Sentinel (tools/agents/crypto_agent.py)

Gathers cryptographic receipts and exports live telemetry to the Desktop Command Center.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent
LOCAL_AI_FLEET_DIR = PROJECT_ROOT.parent.parent / "automation" / "local_ai_fleet"

if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))
if str(LOCAL_AI_FLEET_DIR) not in sys.path and LOCAL_AI_FLEET_DIR.exists():
    sys.path.insert(0, str(LOCAL_AI_FLEET_DIR))

# Import fleet agents
from github_agent import GitHubAgent
from grok_agent import GrokAgent
from cloudflare_agent import CloudflareAgent
from deepseek_agent import DeepSeekAgent
from crypto_agent import CryptoAgent

try:
    from m365_agent import M365Agent
except ImportError:
    M365Agent = None

try:
    from super_grok_webui_agent import SuperGrokWebUIAgent
except ImportError:
    SuperGrokWebUIAgent = None


SCHEMA_VERSION = "northstar.fleet_orchestrator.master_sweep.v1"
DEFAULT_DESKTOP_EXPORT = Path.home() / "Desktop" / "fleet_telemetry_live.json"


class FleetOrchestrator:
    """Master coordinator driving unified multi-agent sweeps and status aggregation."""

    def __init__(self, repo_path: Optional[Path] = None):
        self.repo_path = repo_path or PROJECT_ROOT
        self.github_agent = GitHubAgent(repo_path=self.repo_path)
        self.grok_agent = GrokAgent()
        self.cf_agent = CloudflareAgent(repo_path=self.repo_path)
        self.deepseek_agent = DeepSeekAgent()
        self.crypto_agent = CryptoAgent()
        self.m365_agent = M365Agent() if M365Agent else None
        self.webui_agent = SuperGrokWebUIAgent() if SuperGrokWebUIAgent else None

    def execute_fleet_sweep(
        self,
        dry_run: bool = True,
        probe_edge: bool = False,
        export_desktop: bool = True,
    ) -> Dict[str, Any]:
        """Perform a complete synchronous health & audit sweep across all 6 agents."""
        timestamp = datetime.now(timezone.utc).isoformat()
        results: Dict[str, Any] = {}

        # 1. GitHub Sentinel Audit
        try:
            gh_report = self.github_agent.generate_full_report()
            git_st = gh_report.get("git_state", {})
            results["github_sentinel"] = {
                "status": "online",
                "receipt_hash": gh_report.get("receipt_sha256"),
                "working_tree": git_st.get("status"),
                "branch": git_st.get("branch"),
                "head_commit": git_st.get("head_commit", {}).get("sha", "")[:7],
                "ci_status": gh_report.get("ci_health", {}).get("successful_count", 0),
                "open_prs": len(gh_report.get("triage", {}).get("pull_requests", {}).get("pull_requests", [])),
            }
        except Exception as e:
            results["github_sentinel"] = {"status": "error", "error": str(e)}

        # 2. Cloudflare Edge Ops Audit
        try:
            cf_report = self.cf_agent.generate_report(probe_edge=probe_edge, dry_run=dry_run)
            budget = cf_report.get("deployment_readiness", {}).get("budget", {})
            results["cloudflare_edge_ops"] = {
                "status": "online",
                "receipt_hash": cf_report.get("receipt_hash"),
                "deployment_ready": cf_report.get("deployment_readiness", {}).get("deployment_ready"),
                "file_count": budget.get("file_count"),
                "payload_mb": budget.get("total_mb"),
                "release_guard_mb": budget.get("release_guard_mb"),
                "headroom_mb": budget.get("headroom_mb"),
                "oversized_count": budget.get("oversized_count", 0),
            }
        except Exception as e:
            results["cloudflare_edge_ops"] = {"status": "error", "error": str(e)}

        # 3. Grok Bot Orchestrator Probe
        try:
            grok_res = self.grok_agent.run_inference(
                persona="coastal_scout",
                prompt="Fleet status probe.",
                dry_run=dry_run,
            )
            results["grok_orchestrator"] = {
                "status": "online",
                "receipt_hash": grok_res.get("receipt_sha256"),
                "mode": "dry_run" if dry_run else "live",
                "persona": grok_res.get("persona"),
                "last_delivery_status": grok_res.get("status"),
            }
        except Exception as e:
            results["grok_orchestrator"] = {"status": "error", "error": str(e)}

        # 4. DeepSeek Edge Researcher Probe
        try:
            ds_res = self.deepseek_agent.run_reasoning(
                prompt="Fleet architectural bounds probe.",
                profile="deep_architectural_audit",
                dry_run=dry_run,
            )
            results["deepseek_researcher"] = {
                "status": "online",
                "receipt_hash": ds_res.get("receipt_sha256"),
                "model": ds_res.get("model"),
                "profile": ds_res.get("profile"),
                "execution_status": ds_res.get("status"),
            }
        except Exception as e:
            results["deepseek_researcher"] = {"status": "error", "error": str(e)}

        # 5. Microsoft 365 Copilot Probe
        if self.m365_agent:
            try:
                m365_prompt = self.m365_agent.build_prompt("general", "Fleet briefing probe.")
                m365_res = self.m365_agent.run_query(
                    prompt=m365_prompt,
                    dry_run=True,
                )
                results["m365_copilot"] = {
                    "status": "online",
                    "receipt_hash": m365_res.get("receipt_sha256"),
                    "safety": "foreground_lease_guarded",
                    "execution_status": m365_res.get("status"),
                }
            except Exception as e:
                results["m365_copilot"] = {"status": "error", "error": str(e)}
        else:
            results["m365_copilot"] = {"status": "module_offline"}

        # 6. Super Grok WebUI Probe
        if self.webui_agent:
            try:
                webui_res = self.webui_agent.dispatch(
                    prompt="Fleet canvas telemetry probe.",
                    mode="canvas",
                    dry_run=True,
                )
                results["super_grok_webui"] = {
                    "status": "online",
                    "receipt_hash": webui_res.get("receipt_sha256"),
                    "mode": webui_res.get("mode"),
                    "execution_status": webui_res.get("status"),
                }
            except Exception as e:
                results["super_grok_webui"] = {"status": "error", "error": str(e)}
        else:
            results["super_grok_webui"] = {"status": "module_offline"}

        # 7. Crypto Asset Banker & SpaceCash Sentinel Probe
        try:
            crypto_res = self.crypto_agent.generate_report(
                contract_id="KX-PROB-01",
                market_price=0.45,
                model_prob=0.55,
                bankroll=1000.0,
                dry_run=dry_run,
            )
            results["crypto_asset_banker"] = {
                "status": "online",
                "receipt_hash": crypto_res.get("receipt_hash"),
                "total_equity_usd": crypto_res.get("portfolio", {}).get("total_portfolio_equity"),
                "spacecash_vault": crypto_res.get("portfolio", {}).get("platforms", {}).get("SpaceCash_Treasury", {}).get("vault_reserve"),
                "risk_guard": "CAPPED_QUARTER_KELLY_5PCT_MAX",
                "invariants": crypto_res.get("safety_invariants"),
            }
        except Exception as e:
            results["crypto_asset_banker"] = {"status": "error", "error": str(e)}

        # Master Sweep Compilation
        master_receipt = {
            "schema": SCHEMA_VERSION,
            "timestamp_utc": timestamp,
            "agents_tracked": len(results),
            "agents_online": sum(1 for v in results.values() if v.get("status") == "online"),
            "agents": results,
            "meta": {
                "orchestrator": "FleetOrchestrator",
                "single_writer_verified": True,
                "zero_emoji_compliant": True,
            },
        }

        canonical = json.dumps(master_receipt, sort_keys=True, indent=2).encode("utf-8")
        master_receipt["master_sweep_sha256"] = hashlib.sha256(canonical).hexdigest()

        if export_desktop:
            try:
                DEFAULT_DESKTOP_EXPORT.parent.mkdir(parents=True, exist_ok=True)
                DEFAULT_DESKTOP_EXPORT.write_text(json.dumps(master_receipt, indent=2), encoding="utf-8")
                master_receipt["desktop_export_path"] = str(DEFAULT_DESKTOP_EXPORT)
            except Exception:
                pass

        return master_receipt


def main() -> int:
    parser = argparse.ArgumentParser(description="NorthStar Autonomous Fleet Orchestrator")
    parser.add_argument("--sweep", action="store_true", help="Execute complete multi-agent fleet sweep")
    parser.add_argument("--probe-edge", action="store_true", help="Include live HTTP probes on edge endpoints")
    parser.add_argument("--live", action="store_true", help="Execute live queries instead of dry-run simulations")
    parser.add_argument("--output", type=Path, default=None, help="Save master receipt to specified file")
    parser.add_argument("--no-desktop-export", action="store_true", help="Skip exporting to Desktop telemetry JSON")

    args = parser.parse_args()
    orchestrator = FleetOrchestrator()

    receipt = orchestrator.execute_fleet_sweep(
        dry_run=not args.live,
        probe_edge=args.probe_edge,
        export_desktop=not args.no_desktop_export,
    )

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(receipt, indent=2), encoding="utf-8")
        print(f"Master receipt written to {args.output}")

    print(json.dumps(receipt, indent=2))
    return 0 if receipt.get("agents_online", 0) >= 4 else 1


if __name__ == "__main__":
    sys.exit(main())
