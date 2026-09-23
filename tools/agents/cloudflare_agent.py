#!/usr/bin/env python3
"""Autonomous Cloudflare Edge Ops Agent for deployment verification, release budget monitoring, and edge telemetry.

Audits Cloudflare Pages artifacts, verifies budget ceiling headroom (<930 MB),
monitors public availability, and emits verifiable cryptographic receipts.
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
import urllib.error
import urllib.request


SCHEMA_VERSION = "northstar.cloudflare_agent.report.v1"
RELEASE_GUARD_BYTES = 930_000_000
FILE_LIMIT_BYTES = 100_000_000
DEFAULT_ARTIFACT_REL = Path("output") / "pages-artifact"
DEFAULT_ENDPOINTS = [
    "https://northstarprime.pages.dev",
    "https://northstarprime.net",
]


class CloudflareAgent:
    """Agent driving Cloudflare Pages release guards and edge network checks."""

    def __init__(self, repo_path: Optional[Path] = None):
        self.repo_path = repo_path.resolve() if repo_path else Path(__file__).resolve().parent.parent.parent
        self.default_artifact_path = self.repo_path / DEFAULT_ARTIFACT_REL

    def audit_release_budget(self, target_path: Optional[Path] = None) -> Dict[str, Any]:
        """Audit the size and file distribution of the Pages artifact against the 930 MB release guard."""
        artifact = (target_path or self.default_artifact_path).resolve()
        if not artifact.exists():
            return {
                "status": "missing_artifact",
                "artifact_path": str(artifact),
                "error": "Pages artifact directory does not exist. Run tools/build_pages_artifact.py first.",
            }

        file_count = 0
        total_bytes = 0
        oversized_files: List[Dict[str, Any]] = []
        largest_files: List[Dict[str, Any]] = []

        all_files: List[tuple[Path, int]] = []
        for path in artifact.rglob("*"):
            if not path.is_file():
                continue
            size = path.stat().st_size
            file_count += 1
            total_bytes += size
            all_files.append((path.relative_to(artifact), size))
            if size >= FILE_LIMIT_BYTES:
                oversized_files.append({"path": str(path.relative_to(artifact)), "bytes": size})

        for p, s in sorted(all_files, key=lambda x: x[1], reverse=True)[:10]:
            largest_files.append({"path": str(p), "bytes": s, "mb": round(s / (1024 * 1024), 2)})

        headroom_bytes = RELEASE_GUARD_BYTES - total_bytes
        passed_guard = total_bytes < RELEASE_GUARD_BYTES and len(oversized_files) == 0

        return {
            "status": "ok" if passed_guard else "budget_exceeded",
            "artifact_path": str(artifact),
            "file_count": file_count,
            "total_bytes": total_bytes,
            "total_mb": round(total_bytes / (1024 * 1024), 2),
            "release_guard_bytes": RELEASE_GUARD_BYTES,
            "release_guard_mb": round(RELEASE_GUARD_BYTES / (1024 * 1024), 2),
            "headroom_bytes": headroom_bytes,
            "headroom_mb": round(headroom_bytes / (1024 * 1024), 2),
            "passed_guard": passed_guard,
            "oversized_count": len(oversized_files),
            "oversized_files": oversized_files,
            "largest_files": largest_files,
        }

    def audit_edge_availability(
        self,
        endpoints: Optional[List[str]] = None,
        timeout: int = 5,
        dry_run: bool = False,
    ) -> List[Dict[str, Any]]:
        """Perform non-destructive HTTP HEAD/GET probes on edge deployment endpoints."""
        urls = endpoints or DEFAULT_ENDPOINTS
        results: List[Dict[str, Any]] = []

        if dry_run:
            for url in urls:
                results.append({
                    "url": url,
                    "status_code": 200,
                    "reachable": True,
                    "dry_run": True,
                    "note": "Dry run mock probe",
                })
            return results

        headers = {
            "User-Agent": "NorthStar-Cloudflare-Sentinel/1.0",
            "Accept": "text/html,application/xhtml+xml",
        }

        for url in urls:
            res: Dict[str, Any] = {"url": url, "status_code": None, "reachable": False}
            req = urllib.request.Request(url, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=timeout) as response:
                    res["status_code"] = response.status
                    res["reachable"] = 200 <= response.status < 400
                    res["server_header"] = response.headers.get("Server", "unknown")
                    res["cf_ray"] = response.headers.get("CF-RAY", None)
                    res["cf_cache_status"] = response.headers.get("CF-Cache-Status", None)
            except urllib.error.HTTPError as e:
                res["status_code"] = e.code
                res["reachable"] = e.code in (401, 403)
                res["error"] = str(e)
            except Exception as e:
                res["reachable"] = False
                res["error"] = type(e).__name__ + ": " + str(e)

            results.append(res)

        return results

    def verify_deployment_readiness(self, target_path: Optional[Path] = None) -> Dict[str, Any]:
        """Verify readiness of the Pages artifact before deployment."""
        budget = self.audit_release_budget(target_path)
        is_ready = budget.get("passed_guard", False) and budget.get("file_count", 0) > 0
        return {
            "deployment_ready": is_ready,
            "budget": budget,
            "checks": {
                "artifact_exists": budget.get("status") != "missing_artifact",
                "under_930mb_guard": budget.get("passed_guard", False),
                "zero_oversized_blobs": budget.get("oversized_count", 0) == 0,
            },
        }

    def generate_report(
        self,
        target_path: Optional[Path] = None,
        endpoints: Optional[List[str]] = None,
        probe_edge: bool = False,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """Compile a full edge and deployment readiness report with cryptographic receipt hash."""
        now_utc = datetime.now(timezone.utc).isoformat()
        readiness = self.verify_deployment_readiness(target_path)
        edge_probes = self.audit_edge_availability(endpoints, dry_run=dry_run) if probe_edge else []

        report: Dict[str, Any] = {
            "schema": SCHEMA_VERSION,
            "timestamp_utc": now_utc,
            "deployment_readiness": readiness,
            "edge_probes": edge_probes,
            "metadata": {
                "agent": "CloudflareAgent",
                "role": "Edge Infrastructure & Pages Release Guard",
            },
        }

        canonical_bytes = json.dumps(report, sort_keys=True, indent=2).encode("utf-8")
        report["receipt_hash"] = hashlib.sha256(canonical_bytes).hexdigest()
        return report

    def format_markdown(self, report: Dict[str, Any]) -> str:
        """Render markdown summary of report for human or board sync consumption."""
        b = report.get("deployment_readiness", {}).get("budget", {})
        status = report.get("deployment_readiness", {}).get("deployment_ready", False)
        status_label = "READY FOR RELEASE" if status else "RELEASE BLOCKED"

        lines = [
            f"# Cloudflare Edge Ops Report — {status_label}",
            f"- **Timestamp**: `{report.get('timestamp_utc')}`",
            f"- **Receipt SHA-256**: `{report.get('receipt_hash')}`",
            f"- **Artifact File Count**: `{b.get('file_count', 'N/A')}`",
            f"- **Payload Size**: `{b.get('total_mb', 'N/A')} MB` / Guard: `{b.get('release_guard_mb', 930)} MB`",
            f"- **Safe Headroom**: `{b.get('headroom_mb', 'N/A')} MB`",
            f"- **Oversized Files (>100MB)**: `{b.get('oversized_count', 0)}`",
        ]

        if report.get("edge_probes"):
            lines.append("\n## Edge Probes")
            for probe in report["edge_probes"]:
                lines.append(f"- `{probe['url']}`: Status `{probe.get('status_code')}` (Reachable: `{probe.get('reachable')}`)")

        return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Cloudflare Edge Ops Sentinel")
    parser.add_argument("--artifact-dir", type=Path, default=None, help="Path to Pages artifact directory")
    parser.add_argument("--probe-edge", action="store_true", help="Perform live HTTP probes on edge endpoints")
    parser.add_argument("--dry-run", action="store_true", help="Execute without external network probes")
    parser.add_argument("--output", type=Path, default=None, help="Path to save JSON receipt")
    parser.add_argument("--markdown", action="store_true", help="Print markdown summary to stdout")

    args = parser.parse_args()
    agent = CloudflareAgent()
    report = agent.generate_report(
        target_path=args.artifact_dir,
        probe_edge=args.probe_edge,
        dry_run=args.dry_run,
    )

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"Receipt written to {args.output}")

    if args.markdown:
        print(agent.format_markdown(report))
    else:
        print(json.dumps(report, indent=2))

    return 0 if report.get("deployment_readiness", {}).get("deployment_ready") else 1


if __name__ == "__main__":
    sys.exit(main())
