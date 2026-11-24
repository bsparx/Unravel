"""CLI entry point for `python3 -m unravel_desktop`."""

from __future__ import annotations

import sys

from .app import main

if __name__ == "__main__":
    sys.exit(main(sys.argv))
