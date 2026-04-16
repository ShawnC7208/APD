# APD Provenance Model

Provenance explains how an APD came to exist and what a reviewer should trust.

The provenance model is not decoration. It is how APD answers the questions that reviewable workflow procedures raise before anyone exports them to runtime markdown.

## Reviewer questions

These are the questions provenance is meant to answer:

- Was this procedure observed, authored, converted, or generated?
- If it was observed, what session did it come from?
- What environment was actually in scope during observation or source collection?
- Which nodes were directly observed versus inferred later?
- Which parts deserve the most scrutiny before runtime use?

## Source types

| `source_type` | Reviewer question it answers |
|---|---|
| `observed` | Was this APD synthesized from a real captured workflow? |
| `authored` | Was this written directly by a human instead of synthesized? |
| `converted` | Did this come from another structured process format such as BPMN? |
| `generated` | Was this generated automatically from some other system output? |

## Important provenance fields

### `source_session_id`

Reviewer question: "Which capture session or observation produced this APD?"

Use it when the APD came from a concrete session and you want reviewers to trace back to the source material.

### `capture_scope`

Reviewer question: "What environment was actually observed?"

This is where you list:

- `applications`
- `key_files`

It prevents reviewers from assuming a procedure is more general than the capture really supported.

### `confidence.overall`

Reviewer question: "How hard should I look at this document before approving it?"

This is review confidence, not runtime success probability.

### `confidence.per_node[]`

Reviewer question: "Which exact steps or branches are most suspect?"

This is where low-confidence synthesized nodes become visible without forcing a reviewer to distrust the whole APD equally.

### `observed_vs_inferred_summary`

Reviewer question: "What is the short plain-language story of what was observed versus synthesized?"

This field is especially useful in PRs, review tools, or approval dashboards where a reviewer wants the summary before opening the full JSON.

## `observed_vs_inferred`

`observed_vs_inferred` appears on both nodes and transitions.

Use:

- `observed` when the step or branch is grounded in behavior that was actually seen
- `inferred` when the synthesizer generalized, filled a gap, or introduced a branch not directly shown
- `authored` when a human wrote the graph element directly

Reviewer question: "Did someone actually do this, or did the synthesizer guess?"

That is the most important provenance question APD answers that exported markdown SOPs usually cannot.

## Typical shapes

### Observed APDs

Usually include:

- `source_session_id`
- `capture_scope`
- mixed `observed_vs_inferred`
- non-uniform `confidence.per_node`

### Authored APDs

Usually include:

- no capture-session fields
- `observed_vs_inferred: authored` across the graph
- high, uniform confidence

### Converted APDs

Usually include:

- no capture-session fields
- some explanation of the upstream artifact
- mixed confidence depending on the fidelity of conversion

## Launch example

[`../examples/refund-escalation-synthesized.apd.json`](../examples/refund-escalation-synthesized.apd.json) is the best launch example to inspect.

It shows:

- directly observed actions
- inferred routing and approval logic
- non-uniform per-node confidence
- reviewer notes that explain why some nodes should be checked more carefully
