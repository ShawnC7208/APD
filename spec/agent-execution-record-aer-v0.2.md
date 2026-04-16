# Agent Execution Record (AER) v0.2

AER v0.2 is the preferred execution receipt format for comparing a runtime execution against an APD contract.

Short version:

```text
APD = the plan
AER = the receipt
```

APD remains the reusable procedure definition. AER v0.2 records the execution facts needed to answer whether a run conformed to that APD.

## Relationship to v0.1

AER v0.1 remains frozen as the minimal launch receipt.

Use AER v0.2 when you need:

- explicit transitions taken through the APD graph
- structured pre-state and completion-check results
- explicit approval decisions
- final outputs for APD conformance checks
- per-node errors and recovery metadata

## Purpose

Use AER v0.2 when you need to answer questions like:

- which APD revision was executed
- which nodes ran, in which order, and on which attempt
- which transitions were actually taken
- whether required checks passed before and after each node
- whether approvals were granted, denied, or canceled
- what outputs the execution produced
- whether the execution conformed to the APD contract

## Document shape

An AER v0.2 document uses:

- `kind: "agent-execution-record"`
- `spec_version: "0.2.0"`
- `execution_id`
- `procedure_ref`
- `executor`
- `started_at`
- `completed_at`
- `overall_outcome`
- `node_executions[]`
- `transitions_taken[]`
- `approvals[]`
- `evidence[]`
- `final_outputs`
- `integrity`
- `extensions`

## Core fields

### `procedure_ref`

References the APD that was executed without embedding or mutating it.

Expected fields:

- `kind`
- `procedure_id`
- `revision`
- `spec_version`

### `node_executions[]`

Each entry represents one observed execution attempt of one APD node.

Required fields:

- `node_id`
- `entered_at`
- `outcome`
- `attempt`

Useful optional fields:

- `exited_at`
- `input_bindings`
- `output_bindings`
- `tool_invocations[]`
- `evidence_refs[]`
- `pre_state_check_results[]`
- `completion_check_results[]`
- `error`
- `recovery_applied`

### `transitions_taken[]`

Records the exact graph edges chosen by the adapter during execution.

Expected fields:

- `from`
- `to`
- `taken_at`

Optional fields:

- `condition`

### `approvals[]`

Records adapter-owned approval decisions associated with APD approval nodes.

Required fields:

- `node_id`
- `decision`
- `decided_by`
- `decided_at`

`decision` is one of:

- `approved`
- `denied`
- `canceled`

### `final_outputs`

Holds the normalized execution outputs that should be compared against the APD `outputs_schema`.

### `evidence[]`

Declares the evidence artifacts referenced from node executions, checks, approvals, and errors.

v0.2 still keeps evidence intentionally light:

- `id`
- `type`
- `reference`

### `integrity`

Holds hash-chain or signature metadata when the recorder supports it.

v0.2 still standardizes:

- `chain_hash`
- optional `signature`

## Adapter guidance

The adapter is the source of truth for AER, not the model.

Recommended pattern:

1. Load and validate the APD.
2. Resolve runtime inputs.
3. Execute one APD node at a time through a focused runtime envelope.
4. Normalize model and tool output into APD-aligned bindings.
5. Record transitions, approvals, checks, and outcomes in AER.
6. Store bulky or sensitive artifacts outside AER and reference them through `evidence[]`.

Keep raw transcripts, full tool payloads, screenshots, emails, and vendor-specific traces out of core AER fields.

If an adapter has OpenTelemetry or vendor trace IDs, store them under `extensions.observability.trace_ref`.

## Comparison model

AER v0.2 is optimized first for APD conformance, not observed-session replay diffing.

Typical comparison questions are:

- did the execution stay on valid APD edges
- did required approvals happen before proceeding
- did required checks pass
- did the final outputs satisfy the APD outputs schema

Comparing a run to the original capture session remains future work.

## Example

```json
{
  "kind": "agent-execution-record",
  "spec_version": "0.2.0",
  "execution_id": "exec_invoice_logging_002",
  "procedure_ref": {
    "kind": "agent-procedure",
    "procedure_id": "log-invoice-to-tracker",
    "revision": "1",
    "spec_version": "0.1.0"
  },
  "executor": {
    "agent": "claude-sonnet-4.5",
    "adapter": "apd-strands-reference",
    "environment": "local-demo"
  },
  "started_at": "2026-04-14T16:00:00Z",
  "completed_at": "2026-04-14T16:04:12Z",
  "overall_outcome": "success",
  "node_executions": [
    {
      "node_id": "step_3",
      "entered_at": "2026-04-14T16:01:04Z",
      "exited_at": "2026-04-14T16:01:29Z",
      "outcome": "completed",
      "attempt": 1,
      "pre_state_check_results": [
        {
          "check": "The tracker workbook is open.",
          "passed": true
        }
      ],
      "completion_check_results": [
        {
          "check": "The vendor name and amount appear in the selected row.",
          "passed": true,
          "evidence_refs": ["evidence:screenshot:tracker-row-42"]
        }
      ],
      "output_bindings": {
        "tracker_row": "April!B42"
      }
    }
  ],
  "transitions_taken": [
    {
      "from": "step_3",
      "to": "decision_1",
      "taken_at": "2026-04-14T16:01:30Z"
    }
  ],
  "approvals": [
    {
      "node_id": "approval_1",
      "decision": "approved",
      "decided_by": "finance-manager@example.com",
      "decided_at": "2026-04-14T16:02:06Z"
    }
  ],
  "evidence": [
    {
      "id": "evidence:screenshot:tracker-row-42",
      "type": "screenshot",
      "reference": "artifacts/screenshots/tracker-row-42.png"
    }
  ],
  "final_outputs": {
    "tracker_row": "April!B42",
    "confirmation_sent": "sent"
  },
  "integrity": {
    "chain_hash": "sha256:..."
  },
  "extensions": {
    "observability": {
      "trace_ref": "otel://local-demo/traces/abc123"
    }
  }
}
```

## Relationship to observability systems

AER complements, rather than replaces:

- model-call telemetry
- orchestration traces
- audit logs
- security logging

Those systems answer infrastructure and model questions. AER answers procedure-execution questions.

## Scope for this repo

This repo now includes:

- this AER v0.2 spec
- a JSON Schema at [`../schema/agent-execution-record-v0.2.schema.json`](../schema/agent-execution-record-v0.2.schema.json)
- a worked v0.2 example at [`../examples/invoice-logging.aer-v0.2.json`](../examples/invoice-logging.aer-v0.2.json)

Observed-session replay diffing remains future work.
