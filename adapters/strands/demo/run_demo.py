"""Minimal Strands demo that loads a generated SOP as the system prompt."""

from __future__ import annotations

import argparse
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the APD-generated SOP with a Strands agent after local dependencies are installed."
    )
    parser.add_argument(
        "task",
        nargs="?",
        default="Start the invoice logging workflow.",
        help="Prompt to send to the agent.",
    )
    parser.add_argument(
        "--sop",
        default=str(Path(__file__).parent / "agent-sops" / "log-invoice-to-tracker.sop.md"),
        help="Path to the exported SOP markdown file.",
    )
    return parser.parse_args()


def load_sop(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def main() -> None:
    args = parse_args()
    sop_text = load_sop(args.sop)

    try:
        from strands import Agent
    except ImportError as exc:  # pragma: no cover - import guard for demo environments
        raise SystemExit(
            "Strands is not installed. Install `strands-agents` first, then rerun this demo."
        ) from exc

    agent = Agent(
        system_prompt=(
            "You are executing a workflow that was exported from APD into SOP markdown.\n\n"
            f"{sop_text}\n\n"
            "Follow the SOP carefully and respect its approval and completion constraints."
        )
    )

    result = agent(args.task)
    print(result)


if __name__ == "__main__":
    main()
