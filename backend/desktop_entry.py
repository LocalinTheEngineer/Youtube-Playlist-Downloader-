"""Executable entry point used by the packaged Windows desktop application."""

from __future__ import annotations

import argparse

import uvicorn

from app.main import app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Playlist Studio local service")
    parser.add_argument("--port", type=int, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=args.port,
        log_level="warning",
        access_log=False,
        log_config=None,
    )


if __name__ == "__main__":
    main()
