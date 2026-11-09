"""Bound the Actions preview; keep the original Lychee artifact and exit code intact."""
import argparse
from pathlib import Path

PREVIEW_BYTES = 512_000

def summarize(report: Path, checker_exit: int) -> str:
    raw = report.read_bytes()
    if not raw:
        raise ValueError("Lychee report is empty; no summary acceptance")
    text = raw.decode("utf-8")
    truncated = len(raw) > PREVIEW_BYTES
    preview = raw[:PREVIEW_BYTES].decode("utf-8", errors="ignore") if truncated else text
    header = (f"## Lychee report\n\nChecker exit code: **{checker_exit}**. Findings are "
              "**report-only**; a green job does not mean zero broken links.\n\n"
              f"Full report: {len(raw):,} bytes. Download the retained **lychee** job artifact "
              "for every finding.\n\n")
    footer = "\n\n**Preview truncated at a UTF-8 boundary; the complete report is retained in the artifact.**\n" if truncated else ""
    return header + preview + footer

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--checker-exit", required=True, type=int, choices=range(256))
    args = parser.parse_args()
    print(summarize(args.report, args.checker_exit), end="")
