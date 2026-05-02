# APD Revision Semantics

This note defines a reviewer convention for classifying APD changes under EU AI Act Article 12(2)(a). APD `revision` is a free-form string, so these rules are conventions rather than schema enforcement.

## Purpose

Article 12(2)(a) asks for events relevant to risk situations or substantial modifications. APD revisions give auditors a stable way to connect an execution receipt to the procedure contract that was in force at the time.

## Substantial Modifications

Classify a change as substantial when it changes the procedure's behavior, risk posture, approval gates, or data contract in a way that can affect execution.

Substantial changes include:

- Adding or removing nodes.
- Adding or removing transitions.
- Changing a node's `type`.
- Tightening an `outputs_schema` so previously valid outputs become invalid.
- Adding a new `approval` node.
- Changing `risk.level` upward.
- Adding a new tool or parameter to `uses`.

Recommended revision increment: MAJOR.

Example:

```text
2 -> 3
2.1 -> 3
```

## Cosmetic Modifications

Classify a change as cosmetic when it improves readability, reviewer context, or descriptive metadata without changing execution requirements.

Cosmetic changes include:

- Wording changes in `instruction`.
- Wording changes in `summary`.
- Wording changes in `title`.
- Adding or removing `context_hints`.
- Lowering `risk.level`.
- Changes to `provenance.observed_vs_inferred_summary`.

Lowering `risk.level` still deserves review, but it is classified separately because it relaxes rather than increases the risk posture.

Recommended revision increment: MINOR.

Example:

```text
2 -> 2.1
2.1 -> 2.2
```

## Reviewer Guidance

Store old APD revisions immutably. Do not rewrite an APD file in place after AERs have been issued against it.

For each APD update, reviewers should record:

- Prior revision.
- New revision.
- Classification: substantial or cosmetic.
- Human reviewer.
- Rationale.
- Date approved.

When in doubt, classify as substantial. That makes the audit trail easier to defend and gives downstream AER comparisons a clear boundary between old and new contracts.

## Relationship to AER

Every AER points to the APD it executed through:

```json
{
  "procedure_ref": {
    "procedure_id": "log-invoice-to-tracker",
    "revision": "3",
    "spec_version": "0.1.0"
  }
}
```

Auditors should compare each AER only against the exact APD revision named in `procedure_ref`.
