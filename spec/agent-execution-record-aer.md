# Agent Execution Record (AER) v0.1

> **Version guidance:** AER v0.1 is frozen as the minimal launch receipt. New integrations should target [AER v0.2](./agent-execution-record-aer-v0.2.md), which adds the richer execution detail needed for APD conformance comparison. v0.1 is retained for consumers that only need the minimal plan-and-receipt story.

AER is the companion artifact for recording what happened when an APD was executed.

Short version:

```text
APD = the plan
AER = the receipt
```

APD stays focused on reusable procedure definition. AER captures execution-time facts such as path taken, approvals granted, evidence produced, and the final outcome.

## Purpose

Use AER when you need to answer questions like:

- which APD revision was executed
- which nodes were entered and in what order
- what approvals were granted or denied
- what evidence was produced
- what the final execution outcome was

This launch ships a minimal AER v0.1 so the plan-and-receipt story is concrete, but AER intentionally remains outside the SDK and CLI validation flow for now.

## Document shape

An AER v0.1 document uses:

- `kind: "agent-execution-record"`
- `spec_version: "0.1.0"`
- `execution_id`
- `procedure_ref`
- `executor`
- `started_at`
- `completed_at`
- `overall_outcome`
- `node_executions[]`
- `approvals[]`
- `evidence[]`
- `integrity`
- `extensions`

## Field notes

### `procedure_ref`

References the APD that was executed without embedding or mutating it.

Expected fields:

- `kind`
- `procedure_id`
- `revision`
- `spec_version`

### `node_executions[]`

Each entry represents one observed execution of one APD node.

Suggested minimum fields:

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

### `approvals[]`

Records human or system approval events associated with APD approval nodes.

### `evidence[]`

Declares the evidence artifacts referenced from node executions. v0.1 keeps this intentionally light: an `id`, `type`, and `reference` are enough.

### `integrity`

Holds hash-chain or signature metadata when the recorder supports it. v0.1 only standardizes `chain_hash` and an optional `signature`.

## Example

```json
{
  "kind": "agent-execution-record",
  "spec_version": "0.1.0",
  "execution_id": "exec_invoice_logging_001",
  "procedure_ref": {
    "kind": "agent-procedure",
    "procedure_id": "log-invoice-to-tracker",
    "revision": "1",
    "spec_version": "0.1.0"
  },
  "executor": {
    "agent": "claude-sonnet-4.5",
    "adapter": "apd-strands-demo",
    "environment": "local-demo"
  },
  "started_at": "2026-04-14T16:00:00Z",
  "completed_at": "2026-04-14T16:03:21Z",
  "overall_outcome": "success",
  "node_executions": [
    {
      "node_id": "step_3",
      "entered_at": "2026-04-14T16:01:04Z",
      "exited_at": "2026-04-14T16:01:29Z",
      "outcome": "completed",
      "attempt": 1,
      "output_bindings": {
        "tracker_row": "April!B42"
      },
      "tool_invocations": [
        {
          "tool": "spreadsheet-edit",
          "duration_ms": 2140
        }
      ],
      "evidence_refs": ["evidence:screenshot:tracker-row-42"]
    }
  ],
  "approvals": [
    {
      "node_id": "approval_1",
      "approved_by": "finance-manager@example.com",
      "approved_at": "2026-04-14T16:02:06Z",
      "comment": "Threshold exception approved."
    }
  ],
  "evidence": [
    {
      "id": "evidence:screenshot:tracker-row-42",
      "type": "screenshot",
      "reference": "artifacts/screenshots/tracker-row-42.png"
    }
  ],
  "integrity": {
    "chain_hash": "sha256:..."
  },
  "extensions": {}
}
```

## Relationship to observability systems

AER complements, rather than replaces:

- model-call telemetry
- orchestration traces
- audit logs
- security logging

Those systems answer infrastructure and model questions. AER answers procedure-execution questions.

## Scope for launch

This repo now includes:

- this minimal AER v0.1 spec
- a JSON Schema at [`../schema/agent-execution-record-v0.1.schema.json`](../schema/agent-execution-record-v0.1.schema.json)
- one worked example at [`../examples/invoice-logging.aer.json`](../examples/invoice-logging.aer.json)

Not included in launch scope:

- SDK helpers
- CLI validation
- conformance fixtures
- execution-runtime integrations
