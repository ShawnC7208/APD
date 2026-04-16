"""Minimal AER v0.2 recorder used by the Strands reference demo."""

from __future__ import annotations

import copy
import hashlib
import json
from datetime import datetime, timezone


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class AERRecorder:
    def __init__(self, execution_id: str, procedure: dict, executor: dict, started_at: str | None = None) -> None:
        self.document = {
            "kind": "agent-execution-record",
            "spec_version": "0.2.0",
            "execution_id": execution_id,
            "procedure_ref": {
                "kind": "agent-procedure",
                "procedure_id": procedure["procedure_id"],
                "revision": procedure["revision"],
                "spec_version": procedure["spec_version"],
            },
            "executor": copy.deepcopy(executor),
            "started_at": started_at or utc_now(),
            "overall_outcome": "partial",
            "node_executions": [],
            "transitions_taken": [],
            "approvals": [],
            "evidence": [],
            "integrity": {
                "chain_hash": "sha256:pending",
            },
            "extensions": {},
        }

    def _latest_execution(self, node_id: str, attempt: int | None = None) -> dict:
        matches = [item for item in self.document["node_executions"] if item["node_id"] == node_id]
        if not matches:
            raise ValueError(f"No execution recorded for node '{node_id}'")

        if attempt is None:
            return matches[-1]

        for item in matches:
            if item["attempt"] == attempt:
                return item

        raise ValueError(f"No execution recorded for node '{node_id}' attempt {attempt}")

    def add_evidence(self, evidence: dict) -> None:
        if any(item["id"] == evidence["id"] for item in self.document["evidence"]):
            return

        self.document["evidence"].append(
            {
                "id": evidence["id"],
                "type": evidence["type"],
                "reference": evidence["reference"],
            }
        )

    def enter_node(self, node_id: str, *, entered_at: str | None = None, input_bindings: dict | None = None) -> int:
        attempt = len([item for item in self.document["node_executions"] if item["node_id"] == node_id]) + 1
        self.document["node_executions"].append(
            {
                "node_id": node_id,
                "entered_at": entered_at or utc_now(),
                "outcome": "paused",
                "attempt": attempt,
                "input_bindings": copy.deepcopy(input_bindings or {}),
                "tool_invocations": [],
                "evidence_refs": [],
                "pre_state_check_results": [],
                "completion_check_results": [],
            }
        )
        return attempt

    def record_check_result(
        self,
        node_id: str,
        *,
        phase: str,
        check: str,
        passed: bool,
        attempt: int | None = None,
        evaluated_at: str | None = None,
        evidence_refs: list[str] | None = None,
    ) -> None:
        execution = self._latest_execution(node_id, attempt)
        field = "pre_state_check_results" if phase == "pre_state" else "completion_check_results"
        execution[field].append(
            {
                "check": check,
                "passed": bool(passed),
                "evaluated_at": evaluated_at or utc_now(),
                "evidence_refs": copy.deepcopy(evidence_refs or []),
            }
        )

    def record_tool_invocation(self, node_id: str, *, tool: str, attempt: int | None = None, **kwargs: object) -> None:
        execution = self._latest_execution(node_id, attempt)
        invocation = {"tool": tool}
        for key in ["started_at", "completed_at", "duration_ms", "outcome", "evidence_refs"]:
            if key in kwargs and kwargs[key] is not None:
                invocation[key] = copy.deepcopy(kwargs[key])
        execution["tool_invocations"].append(invocation)

    def record_approval_decision(
        self,
        node_id: str,
        *,
        decision: str,
        decided_by: str,
        decided_at: str | None = None,
        comment: str | None = None,
        evidence_refs: list[str] | None = None,
    ) -> None:
        self.document["approvals"].append(
            {
                "node_id": node_id,
                "decision": decision,
                "decided_by": decided_by,
                "decided_at": decided_at or utc_now(),
                "comment": comment,
                "evidence_refs": copy.deepcopy(evidence_refs or []),
            }
        )

    def record_transition(self, from_node: str, to_node: str, *, taken_at: str | None = None, condition: str | None = None) -> None:
        entry = {
            "from": from_node,
            "to": to_node,
            "taken_at": taken_at or utc_now(),
        }
        if condition:
            entry["condition"] = condition
        self.document["transitions_taken"].append(entry)

    def exit_node(
        self,
        node_id: str,
        *,
        outcome: str,
        attempt: int | None = None,
        exited_at: str | None = None,
        output_bindings: dict | None = None,
        evidence_refs: list[str] | None = None,
        error: dict | None = None,
        recovery_applied: dict | None = None,
    ) -> None:
        execution = self._latest_execution(node_id, attempt)
        execution["outcome"] = outcome
        execution["exited_at"] = exited_at or utc_now()

        if output_bindings:
            execution["output_bindings"] = copy.deepcopy(output_bindings)
        if evidence_refs is not None:
            execution["evidence_refs"] = copy.deepcopy(evidence_refs)
        if error:
            execution["error"] = copy.deepcopy(error)
        if recovery_applied:
            execution["recovery_applied"] = copy.deepcopy(recovery_applied)

    def finalize(
        self,
        *,
        overall_outcome: str,
        completed_at: str | None = None,
        final_outputs: dict | None = None,
        extensions: dict | None = None,
    ) -> dict:
        self.document["overall_outcome"] = overall_outcome
        self.document["completed_at"] = completed_at or utc_now()

        if final_outputs is not None:
            self.document["final_outputs"] = copy.deepcopy(final_outputs)
        if extensions:
            self.document["extensions"] = copy.deepcopy(extensions)

        snapshot = copy.deepcopy(self.document)
        snapshot.pop("integrity", None)
        digest = hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode("utf-8")).hexdigest()
        self.document["integrity"] = {"chain_hash": f"sha256:{digest}"}
        return self.to_dict()

    def to_dict(self) -> dict:
        return copy.deepcopy(self.document)
