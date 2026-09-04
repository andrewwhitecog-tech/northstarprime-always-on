#!/usr/bin/env python3
"""Retired: the public services route is a canonical continuity bridge."""

from __future__ import annotations

import sys


def main() -> int:
    print(
        "services freeze retired: preserve services/index.html as the canonical "
        "bridge to https://app.northstarprime.net/services",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
