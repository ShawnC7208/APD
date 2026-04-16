# Agent Procedure Definition (APD) v0.1

## Status

APD v0.1 is the initial standalone specification for a machine-readable procedure format.

It is intended to be:

- execution-engine-agnostic
- graph-native
- reviewable by humans
- usable by external agent runtimes

This document is the source of truth for the v0.1 format in this repository.

## Goals

1. Represent a reusable business procedure without replay-specific selectors or coordinates.
2. Preserve human-readable workflow intent while remaining structured enough for validation and tooling.
3. Support branching, approvals, checks, recovery guidance, and provenance.
4. Separate the procedure definition from execution trace artifacts.
5. Allow vendor-specific hints through extensions without polluting the core format.

## Non-goals

1. APD does not define an execution runtime or orchestration loop.
2. APD does not standardize schedules or event envelopes beyond lightweight `entry_conditions`.
3. APD does not carry low-level replay handles such as UIAutomation IDs, CSS selectors, or pixel coordinates.
4. APD does not define a full execution telemetry standard in v0.1.
5. APD should remain separate from any future execution receipt artifact.

## Top-level shape

```json
{
  "kind": "agent-procedure",
  "spec_version": "0.1.0",
  "procedure_id": "log-invoice-to-tracker",
  "revision": "1",
  "title": "Log Invoice to Tracker",
  "summary": "Capture invoice data from an email, record it in the tracker, and confirm receipt.",
  "entry_conditions": [
    "An invoice email arrives for manual review."
  ],
  "inputs_schema": {
    "type": "object",
    "properties": {}
  },
  "outputs_schema": {
    "type": "object",
    "properties": {}
  },
  "entities": [],
  "procedure": {
    "start_node": "step_1",
    "nodes": [],
    "transitions": []
  },
  "provenance": {
    "producer": "capture-system",
    "source_type": "observed",
    "source_session_id": "session_123",
    "created_at": "2026-04-11T14:00:00Z",
    "capture_scope": {
      "applications": ["Outlook", "Excel"],
      "key_files": ["vendor_tracker_april.xlsx"]
    },
    "confidence": {
      "overall": 0.89,
      "per_node": []
    },
    "observed_vs_inferred_summary": "Action nodes were observed from the recording. Decision nodes include inferred routing guidance."
  },
  "extensions": {}
}
```

## Top-level fields

| Field | Meaning |
|---|---|
| `kind` | Fixed identifier for the artifact type. Current value: `agent-procedure`. |
| `spec_version` | APD schema version. Current value: `0.1.0`. |
| `procedure_id` | Stable identifier for the business procedure. |
| `revision` | Revision of this procedure definition. |
| `title` | Human-readable title. |
| `summary` | Short statement of the procedure outcome. |
| `entry_conditions[]` | Lightweight textual start conditions. |
| `inputs_schema` | JSON Schema 2020-12 compatible description of runtime inputs. |
| `outputs_schema` | JSON Schema 2020-12 compatible description of outputs. |
| `entities[]` | Business objects, files, or records referenced by the procedure. May be an empty array when no shared entities are needed. |
| `procedure` | Procedure graph with nodes and transitions. |
| `provenance` | Metadata about how the APD was produced. |
| `extensions` | Namespaced bag for non-core metadata. |

## Procedure graph

APD uses a directed acyclic graph (DAG) rather than a linear list. Cycles are not permitted. A valid APD must include at least one terminal node, and reference validators may additionally check reachability and graph quality.

> **Conformance note.** JSON Schema validation alone is necessary but not sufficient for APD conformance. A conforming validator MUST also enforce: (1) the procedure graph is acyclic, (2) at most one transition from any given source node has `default: true`, (3) the procedure includes at least one terminal node, and (4) every transition's `from` and `to` reference a declared node. The reference implementation in `packages/sdk-typescript` enforces these constraints via `validateApd`.

### `procedure.start_node`

The node ID where execution starts.

### `procedure.nodes[]`

Each node is one of four fixed types in v0.1:

1. `action`
2. `decision`
3. `approval`
4. `terminal`

### `procedure.transitions[]`

Transitions connect nodes and make branching explicit.

| Field | Meaning |
|---|---|
| `from` | Source node ID |
| `to` | Destination node ID |
| `condition` | Optional branch condition |
| `default` | Required boolean indicating whether this transition is the default path. At most one transition from a given source node may have `default: true`. |
| `observed_vs_inferred` | Whether the branch came from observed behavior, model inference, or direct authoring |

## Node semantics

### Action node

Action nodes represent work to perform.

Required behavior:

- `instruction` is required and should be executable without replay-specific handles

Optional but recommended fields:

- `uses` and `produces` connect the action to procedure data
- `context_hints` provide resilient environment guidance
- `pre_state_checks` and `completion_checks` define what should be verified
- `recovery` tells an external agent what to do if expected state is not found
- `risk` is where irreversible behavior and confirmation requirements live

### Decision node

Decision nodes make branches explicit instead of burying them in prose.

| Field | Meaning |
|---|---|
| `question` | What the agent is deciding. Required for decision nodes. |
| `evaluation_hint` | How to evaluate the question |

Outgoing transitions carry the actual branch conditions.

### Approval node

Approval nodes are explicit human gates.

| Field | Meaning |
|---|---|
| `approval_required` | Required and must be `true` |
| `reason` | Required. Why the human confirmation is required |

### Terminal node

Terminal nodes end the graph with one of:

- `success`
- `failure`
- `canceled`

`outcome` is required for terminal nodes.

### `observed_vs_inferred`

APD uses `observed_vs_inferred` on nodes and transitions to show how a graph element was produced:

- `observed` means the element was directly grounded in an observed workflow or capture.
- `inferred` means the element was synthesized or generalized from the observed material.
- `authored` means the element was hand-written by a human rather than observed or inferred.

## Entities

`entities[]` names real workflow objects that matter across multiple nodes.

Typical examples:

- files
- invoices
- emails
- tracker rows
- approval records

Required core fields:

| Field | Meaning |
|---|---|
| `id` | Stable entity ID in the APD document |
| `type` | Entity type such as `file`, `record`, or `message` |
| `name` | Human-readable name |
| `description` | Why the entity matters |

Optional fields:

| Field | Meaning |
|---|---|
| `source_hint` | Where it was observed or how to locate it |
| `observed_value` | Optional example captured during recording |

## Provenance model

Provenance is part of the document because APD often comes from observation and inference, not only hand-authoring.

### Fields

| Field | Meaning |
|---|---|
| `producer` | Producer identifier such as `capture-system` or `workflow-synthesizer`. |
| `source_type` | How the APD was produced: `observed`, `authored`, `converted`, or `generated`. |
| `source_session_id` | Observation session that produced this APD when a concrete session exists. Strongly recommended for `source_type: observed`. |
| `created_at` | Generation timestamp. |
| `capture_scope.applications[]` | Apps observed in the source environment. Strongly recommended when `source_type` is `observed` and the environment is known. |
| `capture_scope.key_files[]` | Important files or artifacts observed in the source environment. Strongly recommended when `source_type` is `observed` and known. |
| `confidence.overall` | Document-level review confidence for the APD. |
| `confidence.per_node[]` | Node-level review confidence for non-terminal APD nodes. |
| `observed_vs_inferred_summary` | Summary of what was observed versus inferred. |

`source_type` values:

| Value | Meaning |
|---|---|
| `observed` | Built from an observed workflow, recording, or capture session. |
| `authored` | Written directly by a human without depending on a captured session. |
| `converted` | Converted from another structured process representation such as BPMN. |
| `generated` | Generated automatically from another source, prompt, or system output. |

Common provenance shapes:

- Observed APDs should include `source_session_id` when a concrete observation session exists.
- Observed APDs should include `capture_scope` when known because it improves auditability, review, and reuse.
- Authored APDs usually omit both `source_session_id` and `capture_scope`.
- Converted APDs usually omit capture details and instead describe the upstream artifact in prose or extensions.

Reference validators may warn when `source_type: observed` omits `source_session_id` or `capture_scope`, but those fields are not mandatory in the core schema.

Provenance is not the same thing as an execution trace. A future execution artifact should live in a separate companion format.

Confidence in APD should be interpreted as **review confidence**. It is useful for review prioritization and trust calibration around the synthesized procedure, but it is not a calibrated prediction of runtime execution success.

## Recommended vocabularies

The following vocabularies are recommended for interoperability, but they remain extensible and are not enforced as schema enums in v0.1.

### Recommended `context_hints.type` values

| Value | Meaning |
|---|---|
| `application` | Desktop or web application name |
| `file` | File name or path |
| `url` | Web URL |
| `api` | API endpoint |
| `database` | Database or table reference |
| `environment` | Environment variable or config key |

### Recommended `evidence.type` values

| Value | Meaning |
|---|---|
| `screenshot` | Reference to a captured screenshot |
| `micro_action` | Reference to a captured micro-action event |
| `document` | Reference to a document observed during capture |
| `user_confirmation` | Reference to a human review confirmation |

## Risk model

`risk` annotates actions with how careful a runtime should be before execution.

### `risk.level`

| Value | Meaning |
|---|---|
| `low` | Minor impact and easily reversible |
| `medium` | Moderate impact and reversible with effort |
| `high` | Significant impact and difficult to reverse |
| `critical` | Severe impact, irreversible, or affects external parties materially |

## Recovery strategies

`recovery.strategy` defines the default fallback behavior when a node cannot be executed as expected.

| Value | Meaning |
|---|---|
| `retry` | Re-attempt the same action |
| `ask-user` | Pause and request human guidance |
| `skip` | Skip this node and proceed to the next transition |
| `abort` | Stop execution and report failure |
| `fallback` | Execute the alternative described in `recovery.instructions` |

## Extension rules

Core APD fields should stay vendor-neutral. Everything non-core belongs under `extensions`.

Recommended namespaces:

- `extensions.capture_system`
- `extensions.openai`
- `extensions.anthropic`

Rules:

1. Extensions must not redefine the meaning of core fields.
2. Extensions should be safe to ignore by consumers that do not understand them.
3. Vendor-specific executor hints must not become required for interpreting the core graph.

## Adapter strategy

APD is designed to map cleanly to external execution agents.

### Claude-style and GPT-style adapters

A typical adapter should:

- traverse the APD graph from `start_node`
- use `pre_state_checks` before action execution
- use `completion_checks` after action execution
- pause on `approval` nodes
- respect `risk.confirmation_required`
- use `context_hints` to guide discovery and execution
- treat on-screen content as untrusted until verified

The adapter loop belongs outside the APD specification itself.

## Deferred work

The following are intentionally out of scope for APD v0.1:

1. Trigger and schedule standardization
2. Execution trace and audit schema
3. Full decision-table support
4. Multi-session merge semantics
5. Formal conformance test kit
6. Sub-procedure composition
7. Execution constraints such as timeouts, retry budgets, concurrency limits, and business-hours restrictions
8. Authentication and credential scope declarations

## Related files

- [`../schema/apd-v0.1.schema.json`](../schema/apd-v0.1.schema.json)
- [`../examples/invoice-logging.apd.json`](../examples/invoice-logging.apd.json)
- [`agent-execution-record-aer.md`](agent-execution-record-aer.md)
