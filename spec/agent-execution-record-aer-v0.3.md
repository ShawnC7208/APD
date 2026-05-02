# Agent Execution Record (AER) v0.3

AER v0.3 is the preferred execution receipt format for comparing a runtime execution against an APD contract when compliance-grade integrity metadata is required.

Short version:

```text
APD = the plan
AER = the receipt
```

APD remains the reusable procedure definition. AER v0.3 records the execution facts needed to answer whether a run conformed to that APD.

## Relationship to v0.1

AER v0.1 remains frozen as the minimal launch receipt.

Use AER v0.3 when you need:

- explicit transitions taken through the APD graph
- structured pre-state and completion-check results
- explicit approval decisions
- final outputs for APD conformance checks
- per-node errors and recovery metadata
- a standardized chain hash, Ed25519 signature, and recorder attestation model

## Purpose

Use AER v0.3 when you need to answer questions like:

- which APD revision was executed
- which nodes ran, in which order, and on which attempt
- which transitions were actually taken
- whether required checks passed before and after each node
- whether approvals were granted, denied, or canceled
- what outputs the execution produced
- whether the execution conformed to the APD contract
- whether the receipt has been tampered with after recording

## Document shape

An AER v0.3 document uses:

- `kind: "agent-execution-record"`
- `spec_version: "0.3.0"`
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

v0.3 still keeps evidence intentionally light:

- `id`
- `type`
- `reference`

### `integrity`

Holds hash-chain and signature metadata.

`integrity.chain_hash` is required. New v0.3 recorders SHOULD write it in the form `sha256:<hex>`, where `<hex>` is a lowercase 64-character SHA-256 digest. Legacy strings remain schema-valid only so v0.2 records can be migrated by bumping `spec_version`; they are not considered valid by the v0.3 integrity verifier.

The digest is computed over the canonical JSON of the entire AER document with mutable integrity artifacts removed. To compute the hash, set `integrity` to `{}` and then copy `integrity.previous_chain_hash` back into that object when it is present. Canonicalization follows RFC 8785 (JSON Canonicalization Scheme): object keys sorted lexicographically, no insignificant whitespace, UTF-8 bytes, and numbers serialized according to RFC 8785 section 3.2.2.

Additional standardized fields:

- `previous_chain_hash` (optional) — the `chain_hash` of the prior AER in a per-execution chain. It is absent on the first AER in a chain.
- `signature` (optional) — an Ed25519 signature over the bytes of the full `chain_hash` string, for example `sha256:...`. In v0.3 the signature object is `{ "algorithm": "ed25519", "public_key": "<base64>", "value": "<base64>" }`. The algorithm is fixed to Ed25519 in v0.3. Verifiers MUST validate signatures against a trusted public key supplied out of band; the embedded `public_key` identifies the claimed signing key but does not establish trust. The bare-string signature form from v0.2 remains accepted for backwards compatibility but is deprecated and not verifiable by the v0.3 helper API.
- `transparency_anchor` (optional) — `{ "type": "rfc3161" | "rekor", "reference": "<url-or-id>", "anchored_at": "<rfc3339>" }` for deployments that anchor chain heads in an external timestamp or transparency log.

### `executor.recorder_attestation`

`executor.recorder_attestation` is optional. When present, it lets verifiers confirm that the recorder identity in `executor` was asserted by the holder of a signing key.

Shape:

- `public_key` — base64-encoded Ed25519 public key.
- `signature` — base64-encoded Ed25519 signature over the canonical JSON of `{ "adapter": ..., "agent": ..., "environment": ... }`.
- `attested_at` — RFC 3339 timestamp for when the recorder identity was attested.

This field supports independent log generation: the adapter or recorder, not the model, signs the identity used to produce the receipt.

### `extensions.eu_ai_act`

`extensions.eu_ai_act` is a well-known extension namespace for EU AI Act Article 12 categorization.

At the AER root, adapters writing AERs intended for EU AI Act compliance SHOULD populate:

- `extensions.eu_ai_act.article_12_purpose` — an array containing zero or more of:
  - `risk_signal` for Article 12(2)(a)
  - `post_market` for Article 12(2)(b)
  - `deployer_monitoring` for Article 12(2)(c)

Multiple purposes are normal.

For finer-grained queries, `node_executions[].extensions.eu_ai_act.article_12_purpose` MAY carry the same enum array on individual node execution records.

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

AER v0.3 is optimized first for APD conformance, not observed-session replay diffing.

Typical comparison questions are:

- did the execution stay on valid APD edges
- did required approvals happen before proceeding
- did required checks pass
- did the final outputs satisfy the APD outputs schema

Comparing a run to the original capture session remains future work.

## Example

The compact example below illustrates the shape. For a fully signed, verifiable fixture, use [`../examples/invoice-logging.aer-v0.3.json`](../examples/invoice-logging.aer-v0.3.json) with the public key in [`../examples/keys/aer-v0.3-test-ed25519-public.spki.b64`](../examples/keys/aer-v0.3-test-ed25519-public.spki.b64).

```json
{
  "kind": "agent-execution-record",
  "spec_version": "0.3.0",
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
    "environment": "local-demo",
    "recorder_attestation": {
      "public_key": "MCowBQYDK2VwAyEA...",
      "signature": "base64-ed25519-signature",
      "attested_at": "2026-04-14T16:04:13Z"
    }
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
    "chain_hash": "sha256:4dacc96f7599d3912e4028191f19d0d51c1b33f6aa05a3e4da23c7dbc0306a5a",
    "signature": {
      "algorithm": "ed25519",
      "public_key": "MCowBQYDK2VwAyEA...",
      "value": "base64-ed25519-signature"
    }
  },
  "extensions": {
    "observability": {
      "trace_ref": "otel://local-demo/traces/abc123"
    },
    "eu_ai_act": {
      "article_12_purpose": ["post_market", "deployer_monitoring"]
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

- this AER v0.3 spec
- a JSON Schema at [`../schema/agent-execution-record-v0.3.schema.json`](../schema/agent-execution-record-v0.3.schema.json)
- a worked v0.3 example at [`../examples/invoice-logging.aer-v0.3.json`](../examples/invoice-logging.aer-v0.3.json)

Observed-session replay diffing remains future work.
