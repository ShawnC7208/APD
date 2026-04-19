"""Reference APD-aware Microsoft Agent Framework runtime that emits AER v0.2 receipts."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import subprocess
from pathlib import Path

from aer_recorder import AERRecorder, utc_now


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run an APD through a node-by-node Microsoft Agent Framework adapter loop and emit an AER v0.2 receipt."
    )
    parser.add_argument(
        "--apd",
        default=str(Path(__file__).resolve().parents[3] / "examples" / "invoice-logging.apd.json"),
        help="Path to the APD JSON document.",
    )
    parser.add_argument(
        "--output",
        default="",
        help="Optional file path where the AER v0.2 JSON should be written.",
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Use the built-in deterministic mock executor instead of a live Microsoft Agent Framework model.",
    )
    parser.add_argument(
        "--approve-by",
        default="operator@example.com",
        help="Fallback approver identity used for approval nodes in live mode.",
    )
    return parser.parse_args()


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def validate_apd(apd_path: str) -> None:
    cli_path = repo_root() / "packages" / "cli" / "bin" / "apd.js"
    result = subprocess.run(
        ["node", str(cli_path), "validate", apd_path, "--quiet"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        message = (result.stdout or result.stderr or "").strip() or f"APD validation failed for '{apd_path}'"
        raise SystemExit(message)


def load_json(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def default_output_path(apd_path: str) -> str:
    apd_file = Path(apd_path)
    return str(apd_file.with_suffix("").with_suffix(".aer-v0.2.json"))


def build_mock_runtime() -> tuple[dict[str, dict], dict[str, dict]]:
    node_results = {
        "step_1": {
            "output_bindings": {
                "vendor_name": "Acme Corp",
                "invoice_amount": 15000,
                "sender_email": "finance@vendor.example",
            },
            "completion_check_results": [
                {
                    "check": "The vendor name, amount, and sender email have been identified.",
                    "passed": True,
                    "evidence_refs": ["evidence:email:invoice-1"],
                }
            ],
            "evidence": [
                {
                    "id": "evidence:email:invoice-1",
                    "type": "email",
                    "reference": "mailbox://finance/inbox/2026-04-14/001",
                }
            ],
            "evidence_refs": ["evidence:email:invoice-1"],
        },
        "step_2": {
            "completion_check_results": [
                {
                    "check": "The tracker workbook is open and visible.",
                    "passed": True,
                    "evidence_refs": ["evidence:screenshot:tracker-open"],
                }
            ],
            "evidence": [
                {
                    "id": "evidence:screenshot:tracker-open",
                    "type": "screenshot",
                    "reference": "artifacts/screenshots/tracker-open.png",
                }
            ],
            "evidence_refs": ["evidence:screenshot:tracker-open"],
        },
        "step_3": {
            "output_bindings": {
                "tracker_row": "April!B42",
            },
            "pre_state_check_results": [
                {
                    "check": "The tracker workbook is open.",
                    "passed": True,
                    "evidence_refs": ["evidence:screenshot:tracker-open"],
                }
            ],
            "completion_check_results": [
                {
                    "check": "The vendor name and amount appear in the selected row.",
                    "passed": True,
                    "evidence_refs": ["evidence:screenshot:tracker-row-42"],
                }
            ],
            "tool_invocations": [
                {
                    "tool": "spreadsheet-edit",
                    "duration_ms": 2140,
                    "outcome": "success",
                    "evidence_refs": ["evidence:screenshot:tracker-row-42"],
                }
            ],
            "evidence": [
                {
                    "id": "evidence:screenshot:tracker-row-42",
                    "type": "screenshot",
                    "reference": "artifacts/screenshots/tracker-row-42.png",
                }
            ],
            "evidence_refs": ["evidence:screenshot:tracker-row-42"],
        },
        "decision_1": {
            "output_bindings": {
                "selected_transition": "approval_1",
            },
            "proposed_transition": "approval_1",
        },
        "step_4": {
            "completion_check_results": [
                {
                    "check": "A confirmation reply draft is ready.",
                    "passed": True,
                    "evidence_refs": ["evidence:email:draft-confirmation-1"],
                }
            ],
            "evidence": [
                {
                    "id": "evidence:email:draft-confirmation-1",
                    "type": "email",
                    "reference": "mailbox://finance/drafts/2026-04-14/003",
                }
            ],
            "evidence_refs": ["evidence:email:draft-confirmation-1"],
        },
        "step_5": {
            "output_bindings": {
                "confirmation_sent": "sent",
            },
            "completion_check_results": [
                {
                    "check": "The confirmation email has been sent.",
                    "passed": True,
                    "evidence_refs": ["evidence:email:confirmation-1"],
                }
            ],
            "tool_invocations": [
                {
                    "tool": "email-send",
                    "duration_ms": 3910,
                    "outcome": "success",
                    "evidence_refs": ["evidence:email:confirmation-1"],
                }
            ],
            "evidence": [
                {
                    "id": "evidence:email:confirmation-1",
                    "type": "email",
                    "reference": "mailbox://finance/sent/2026-04-14/004",
                }
            ],
            "evidence_refs": ["evidence:email:confirmation-1"],
        },
    }

    approval_results = {
        "approval_1": {
            "decision": "approved",
            "decided_by": "finance-manager@example.com",
            "comment": "Threshold exception approved.",
            "evidence": [
                {
                    "id": "evidence:user-confirmation:approval-1",
                    "type": "user_confirmation",
                    "reference": "approvals://finance/2026-04-14/approval-1",
                }
            ],
            "evidence_refs": ["evidence:user-confirmation:approval-1"],
        },
        "approval_2": {
            "decision": "approved",
            "decided_by": "operator@example.com",
            "comment": "External reply confirmed.",
            "evidence": [
                {
                    "id": "evidence:user-confirmation:approval-2",
                    "type": "user_confirmation",
                    "reference": "approvals://operator/2026-04-14/approval-2",
                }
            ],
            "evidence_refs": ["evidence:user-confirmation:approval-2"],
        },
    }

    return node_results, approval_results


def build_runtime_envelope(procedure: dict, node: dict, transitions: list[dict], bindings: dict) -> str:
    resolved_inputs = {name: bindings[name] for name in node.get("uses", []) if name in bindings}
    return (
        "You are executing one APD node through a Microsoft Agent Framework adapter.\n\n"
        f"Procedure: {procedure['procedure_id']} - {procedure['title']}\n"
        f"Current node JSON:\n{json.dumps(node, indent=2)}\n\n"
        f"Candidate transitions JSON:\n{json.dumps(transitions, indent=2)}\n\n"
        f"Resolved inputs JSON:\n{json.dumps(resolved_inputs, indent=2)}\n\n"
        "Return a JSON object with these keys:\n"
        "  output_bindings: dict of output variable name to value\n"
        "  pre_state_check_results: list of {check, passed, evidence_refs} objects\n"
        "  completion_check_results: list of {check, passed, evidence_refs} objects\n"
        '  tool_invocations: list of {tool, duration_ms, outcome, evidence_refs} objects - outcome MUST be exactly one of: "success", "failure", "canceled"\n'
        "  evidence: list of {id, type, reference} objects (use empty list [] if none)\n"
        "  evidence_refs: list of evidence ID strings\n"
        "  proposed_transition: the 'to' node ID of the transition to take\n"
        "Do not self-approve approval nodes. Return only the JSON object, no prose."
    )


def build_live_agent():
    try:
        from agent_framework.foundry import FoundryChatClient
    except ImportError as exc:  # pragma: no cover - live mode is optional
        raise SystemExit(
            "Microsoft Agent Framework is not installed. Use --mock or install `agent-framework` and `azure-identity` first."
        ) from exc

    try:
        from azure.identity import AzureCliCredential
    except ImportError as exc:  # pragma: no cover - live mode is optional
        raise SystemExit("`azure-identity` is required for live mode. Install it with `python3 -m pip install azure-identity`.") from exc

    project_endpoint = os.environ.get("APD_MAF_PROJECT_ENDPOINT") or os.environ.get("AZURE_AI_PROJECT_ENDPOINT")
    model = os.environ.get("APD_MAF_MODEL") or os.environ.get("AZURE_AI_MODEL_DEPLOYMENT_NAME")

    if not project_endpoint or not model:
        raise SystemExit(
            "Live mode requires APD_MAF_PROJECT_ENDPOINT and APD_MAF_MODEL, or the Microsoft-style AZURE_AI_PROJECT_ENDPOINT and AZURE_AI_MODEL_DEPLOYMENT_NAME variables."
        )

    client = FoundryChatClient(
        project_endpoint=project_endpoint,
        model=model,
        credential=AzureCliCredential(),
    )

    return client.as_agent(
        name="apd-maf-node-runner",
        instructions="Return valid JSON only. Follow the APD runtime envelope exactly.",
    )


def extract_response_json(response) -> dict:
    text = ""

    if hasattr(response, "text"):
        text = str(response.text).strip()

    if not text and hasattr(response, "messages"):
        messages = getattr(response, "messages", []) or []
        if messages:
            last_message = messages[-1]
            text = str(getattr(last_message, "text", "")).strip()

            if not text and hasattr(last_message, "content"):
                for item in getattr(last_message, "content", []) or []:
                    item_type = getattr(item, "type", None) or (item.get("type") if isinstance(item, dict) else None)
                    if item_type == "text":
                        text = getattr(item, "text", None) or (item.get("text") if isinstance(item, dict) else "")
                        text = str(text).strip()
                        if text:
                            break

            if not text:
                text = str(last_message).strip()

    if not text and hasattr(response, "content"):
        content = getattr(response, "content", []) or []
        for item in content:
            item_type = getattr(item, "type", None) or (item.get("type") if isinstance(item, dict) else None)
            if item_type == "text":
                text = getattr(item, "text", None) or (item.get("text") if isinstance(item, dict) else "")
                text = str(text).strip()
                if text:
                    break

    if not text:
        text = str(response).strip()

    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    if not text:
        raise ValueError(f"Model returned no extractable text for node. Raw response: {response!r}")

    return json.loads(text)


async def live_executor(procedure: dict, node: dict, transitions: list[dict], bindings: dict) -> dict:
    agent = build_live_agent()
    response = await agent.run(build_runtime_envelope(procedure, node, transitions, bindings))
    return extract_response_json(response)


def choose_transition(
    node: dict,
    outgoing: list[dict],
    proposed_transition: str | None = None,
    approval_decision: str | None = None,
) -> dict | None:
    if not outgoing:
        return None

    if proposed_transition:
        for transition in outgoing:
            if transition["to"] == proposed_transition:
                return transition
        raise ValueError(f"Proposed transition '{proposed_transition}' is not a valid outgoing edge for node '{node['id']}'")

    if approval_decision == "approved":
        for transition in outgoing:
            if "approval granted" in transition.get("condition", "").lower():
                return transition
    elif approval_decision in {"denied", "canceled"}:
        for transition in outgoing:
            condition = transition.get("condition", "").lower()
            if "approval denied" in condition or "approval canceled" in condition:
                return transition
        return None

    for transition in outgoing:
        if transition.get("default"):
            return transition

    return outgoing[0]


def write_output(path: str, document: dict) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")


async def main() -> None:
    args = parse_args()
    validate_apd(args.apd)
    procedure = load_json(args.apd)
    output_path = args.output or default_output_path(args.apd)
    node_map = {node["id"]: node for node in procedure["procedure"]["nodes"]}
    transitions = procedure["procedure"]["transitions"]
    mock_results, mock_approvals = build_mock_runtime()
    bindings: dict[str, object] = {"approval_threshold": 5000}

    recorder = AERRecorder(
        execution_id="demo_invoice_logging_maf_v0_2",
        procedure=procedure,
        executor={
            "agent": "mock-maf-agent" if args.mock else "microsoft-agent-framework",
            "adapter": "apd-microsoft-agent-framework-reference",
            "environment": "local-demo",
        },
    )

    current_node_id = procedure["procedure"]["start_node"]
    while True:
        node = node_map[current_node_id]
        outgoing = [transition for transition in transitions if transition["from"] == current_node_id]
        node_inputs = {name: bindings[name] for name in node.get("uses", []) if name in bindings}
        attempt = recorder.enter_node(node["id"], input_bindings=node_inputs)

        if node["type"] == "terminal":
            recorder.exit_node(node["id"], attempt=attempt, outcome="completed")
            final_outputs = {
                name: bindings[name]
                for name in procedure.get("outputs_schema", {}).get("properties", {}).keys()
                if name in bindings
            }
            document = recorder.finalize(
                overall_outcome=node["outcome"],
                final_outputs=final_outputs,
                extensions={
                    "observability": {
                        "trace_ref": f"otel://local-demo/traces/{recorder.document['execution_id']}",
                    }
                },
            )
            write_output(output_path, document)
            print(f"Wrote {output_path}")
            return

        if node["type"] == "approval":
            approval = mock_approvals.get(node["id"]) if args.mock else {
                "decision": "approved",
                "decided_by": args.approve_by,
                "comment": "Approved by adapter-provided approver.",
                "evidence": [],
                "evidence_refs": [],
            }
            for evidence in approval.get("evidence", []):
                recorder.add_evidence(evidence)
            recorder.record_approval_decision(
                node["id"],
                decision=approval["decision"],
                decided_by=approval["decided_by"],
                decided_at=utc_now(),
                comment=approval.get("comment"),
                evidence_refs=approval.get("evidence_refs", []),
            )
            recorder.exit_node(
                node["id"],
                attempt=attempt,
                outcome="approved" if approval["decision"] == "approved" else "rejected",
                evidence_refs=approval.get("evidence_refs", []),
            )
            next_transition = choose_transition(node, outgoing, approval_decision=approval["decision"])
            if next_transition is None:
                fallback_outcome = "canceled" if approval["decision"] == "canceled" else "failure"
                document = recorder.finalize(overall_outcome=fallback_outcome)
                write_output(output_path, document)
                print(f"Wrote {output_path}")
                return
            recorder.record_transition(
                next_transition["from"],
                next_transition["to"],
                condition=next_transition.get("condition"),
            )
            current_node_id = next_transition["to"]
            continue

        result = mock_results[node["id"]] if args.mock else await live_executor(procedure, node, outgoing, bindings)
        for invocation in result.get("tool_invocations", []):
            if invocation.get("outcome") not in ("success", "failure", "canceled"):
                invocation["outcome"] = "success"
        for evidence in result.get("evidence", []):
            if isinstance(evidence, dict):
                recorder.add_evidence(evidence)
        for item in result.get("pre_state_check_results", []):
            recorder.record_check_result(node["id"], attempt=attempt, phase="pre_state", **item)
        for item in result.get("completion_check_results", []):
            recorder.record_check_result(node["id"], attempt=attempt, phase="completion", **item)
        for invocation in result.get("tool_invocations", []):
            recorder.record_tool_invocation(node["id"], attempt=attempt, **invocation)

        bindings.update(result.get("output_bindings", {}))
        recorder.exit_node(
            node["id"],
            attempt=attempt,
            outcome=result.get("outcome", "completed"),
            output_bindings=result.get("output_bindings"),
            evidence_refs=result.get("evidence_refs", []),
        )

        next_transition = choose_transition(node, outgoing, proposed_transition=result.get("proposed_transition"))
        if next_transition is None:
            document = recorder.finalize(overall_outcome="partial")
            write_output(output_path, document)
            print(f"Wrote {output_path}")
            return

        recorder.record_transition(
            next_transition["from"],
            next_transition["to"],
            condition=next_transition.get("condition"),
        )
        current_node_id = next_transition["to"]


if __name__ == "__main__":
    asyncio.run(main())
