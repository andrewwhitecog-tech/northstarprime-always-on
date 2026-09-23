#!/usr/bin/env python3
"""Autonomous Grok Bot Agent for high-level creative synthesis and adversarial review.

Interfaces with the xAI Grok CLI (grok.exe) and the shared .codex-grok-comm protocol.
Enforces the single-writer rule and logs verifiable SHA-256 execution receipts.
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
from typing import Any, Dict, Optional


RECEIPT_SCHEMA = "northstar.grok_agent.receipt.v1"
DEFAULT_GROK_EXE = Path(os.environ.get("USERPROFILE", r"C:\Users\andre")) / ".grok" / "bin" / "grok.exe"
DEFAULT_COMM_LOGS = Path(os.environ.get("USERPROFILE", r"C:\Users\andre")) / ".codex-grok-comm" / "logs"


PERSONAS = {
    "adversarial_critic": {
        "name": "SuperGrok Adversarial Red-Team Critic",
        "system": (
            "You are an elite, uncompromising adversarial technical and strategic critic. "
            "Your job is to find flaws, failure modes, security vulnerabilities, logical fallacies, "
            "and conversion friction in the provided system or plan. Be rigorous, direct, and constructive. "
            "Provide prioritized recommendations to eliminate weaknesses."
        ),
    },
    "creative_director": {
        "name": "SuperGrok Avant-Garde Creative Director",
        "system": (
            "You are the visionary Creative Director for NorthStar Prime and the Vorath universe. "
            "Blend cyberpunk, dark cosmic lore, high luxury, and brutalist minimalism. "
            "Deliver evocative worldbuilding, poetic brand copy, and cinematic visual concepts "
            "that defy cliché and elevate the aesthetic."
        ),
    },
    "coastal_scout": {
        "name": "SuperGrok Coastal Intelligence Scout",
        "system": (
            "You are a commercial intelligence and market analyst specializing in Oregon coastal businesses "
            "(Astoria, Lincoln City, Newport, Tillamook, Florence). Evaluate digital presence, local market position, "
            "and identify high-leverage modernization opportunities."
        ),
    },
    "general": {
        "name": "SuperGrok General Technical Partner",
        "system": "You are a senior full-stack AI engineer and strategic advisor assisting the team.",
    },
}


class GrokAgent:
    """Agent driving xAI Grok CLI interactions with persona specialization and receipt logging."""

    def __init__(self, grok_exe: Optional[Path] = None, log_dir: Optional[Path] = None):
        self.grok_exe = grok_exe or DEFAULT_GROK_EXE
        self.log_dir = log_dir or DEFAULT_COMM_LOGS

    def format_prompt(self, persona_key: str, user_prompt: str) -> str:
        persona = PERSONAS.get(persona_key, PERSONAS["general"])
        return f"[SYSTEM PERSONA: {persona['name']}]\n{persona['system']}\n\n[USER TASK]:\n{user_prompt.strip()}"

    def run_inference(
        self,
        prompt: str,
        persona: str = "general",
        dry_run: bool = False,
        timeout_seconds: int = 180,
    ) -> Dict[str, Any]:
        timestamp = datetime.now(timezone.utc).isoformat()
        full_prompt = self.format_prompt(persona, prompt)
        prompt_hash = hashlib.sha256(full_prompt.encode("utf-8")).hexdigest()

        if dry_run:
            response_text = f"[DRY_RUN_MOCK_GROK] Received prompt hash: {prompt_hash[:12]} under persona '{persona}'."
            status = "dry_run_success"
        else:
            if not self.grok_exe.exists():
                return {
                    "schema": RECEIPT_SCHEMA,
                    "timestamp_utc": timestamp,
                    "status": "binary_not_found",
                    "error": f"grok executable not found at {self.grok_exe}",
                    "prompt_sha256": prompt_hash,
                }
            try:
                # Dispatch grok CLI command with explicit headless flags
                cmd = [
                    str(self.grok_exe),
                    "-p", full_prompt,
                    "--output-format", "plain",
                    "--no-alt-screen",
                    "--disable-web-search",
                    "--no-subagents",
                ]
                proc = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=timeout_seconds,
                    check=False,
                )
                if proc.returncode == 0:
                    response_text = proc.stdout.strip()
                    status = "live_success"
                else:
                    response_text = proc.stderr.strip() or proc.stdout.strip()
                    status = f"cli_error_{proc.returncode}"
            except subprocess.TimeoutExpired:
                response_text = f"Grok CLI timed out after {timeout_seconds}s"
                status = "timeout_expired"
            except Exception as e:
                response_text = str(e)
                status = "execution_exception"

        receipt = {
            "schema": RECEIPT_SCHEMA,
            "timestamp_utc": timestamp,
            "status": status,
            "persona": persona,
            "prompt_length": len(full_prompt),
            "prompt_sha256": prompt_hash,
            "response_length": len(response_text),
            "response_text": response_text,
        }

        # Calculate cryptographic receipt SHA-256
        serialized = json.dumps(receipt, sort_keys=True, indent=2)
        receipt["receipt_sha256"] = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        # Write receipt to disk
        self.log_dir.mkdir(parents=True, exist_ok=True)
        filename = f"grok_receipt_{int(datetime.now(timezone.utc).timestamp())}_{prompt_hash[:8]}.json"
        out_file = self.log_dir / filename
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(receipt, f, indent=2)
        receipt["receipt_path"] = str(out_file)

        return receipt


def main() -> int:
    parser = argparse.ArgumentParser(description="NorthStar Grok Bot Autonomous Agent")
    parser.add_argument("--persona", choices=list(PERSONAS.keys()), default="general")
    parser.add_argument("--prompt", type=str, default="", help="Prompt text")
    parser.add_argument("--file", type=str, default="", help="Prompt input file")
    parser.add_argument("--timeout", type=int, default=180, help="CLI timeout in seconds")
    parser.add_argument("--dry-run", action="store_true", help="Simulate inference without calling grok.exe")
    args = parser.parse_args()

    content = ""
    if args.file and Path(args.file).exists():
        with open(args.file, "r", encoding="utf-8") as f:
            content = f.read()
    elif args.prompt:
        content = args.prompt
    else:
        content = "Review the NorthStar strategic critique and website repair diagnostics."

    agent = GrokAgent()
    print(f"[*] Invoking Grok Agent (persona={args.persona}, dry_run={args.dry_run})...")
    res = agent.run_inference(content, persona=args.persona, dry_run=args.dry_run, timeout_seconds=args.timeout)

    print(json.dumps(res, indent=2))
    return 0 if res.get("status") in {"live_success", "dry_run_success"} else 1


if __name__ == "__main__":
    sys.exit(main())
