# Weekly Source Reconciliation

<!-- apd-procedure-id: weekly-source-reconciliation -->
<!-- apd-revision: 1 -->
<!-- apd-source-type: authored -->

## Overview

Compare two weekly data exports, log discrepancies, and update the reconciliation tracker.

Use this SOP when:

- The weekly exports from both systems are available.

Provenance note: This APD was written directly by a human author and does not depend on capture-session provenance.

## Parameters

- **source_a_export** (optional): File path for the source A export. Type: string.
- **source_b_export** (optional): File path for the source B export. Type: string.

## Steps

### 1. Load both exports

<!-- apd-node step_1 observed_vs_inferred: authored -->
Open the weekly export files from source A and source B so their records can be compared.

**Constraints:**
- You SHOULD complete this action before moving on.
- You MUST verify that both exports are accessible and ready for comparison before advancing.
- You SHOULD use the declared parameters exactly as provided: `source_a_export`, `source_b_export`.

### 2. Compare records

<!-- apd-node step_2 observed_vs_inferred: authored -->
Compare the exports row by row and identify any missing, mismatched, or duplicate records.
This step produces `discrepancy_count`.

**Constraints:**
- You SHOULD complete this action before moving on because it is low risk and the comparison is read-only until the log is updated.
- You MUST verify that any discrepancies between the two exports have been listed before advancing.

### 3. Were discrepancies found?

<!-- apd-node decision_1 observed_vs_inferred: authored -->
Evaluate the decision question: Does the comparison produce any missing, mismatched, or duplicate records?

**Decision paths:**
- If `Discrepancies were found and need to be logged`, continue to **Update reconciliation tracker**.
<!-- apd-transition decision_1->step_3 observed_vs_inferred: authored -->
- If `No discrepancies were found`, continue to **Reconciliation completed without discrepancies**.
<!-- apd-transition decision_1->done_clean observed_vs_inferred: authored -->

**Constraints:**
- You MUST evaluate this question before selecting a path: Does the comparison produce any missing, mismatched, or duplicate records?
- You SHOULD use this evaluation hint: Treat any non-zero discrepancy count as a discrepancy case.
- If `Discrepancies were found and need to be logged`, You MUST continue to **Update reconciliation tracker**.
- If `No discrepancies were found`, You MUST continue to **Reconciliation completed without discrepancies**.

### 4. Update reconciliation tracker

<!-- apd-node step_3 observed_vs_inferred: authored -->
Record the weekly reconciliation result in the tracker, including the discrepancy count and any follow-up needed.
This step produces `tracker_status`.

**Constraints:**
- You SHOULD complete this action before moving on because it is medium risk and tracker updates are operationally important but can be corrected.
- You MUST verify that the reconciliation tracker shows the current week's status before advancing.
- You SHOULD use the declared parameters exactly as provided: `discrepancy_count`.

## Outcomes

<!-- apd-node done_clean observed_vs_inferred: authored -->
### Reconciliation completed without discrepancies

- Outcome: `success`
- APD terminal node: `done_clean`

<!-- apd-node done_flagged observed_vs_inferred: authored -->
### Reconciliation completed with discrepancies flagged

- Outcome: `success`
- APD terminal node: `done_flagged`

## Examples

### Example invocation

```yaml
source_a_export: <string>
source_b_export: <string>
```

### Expected outcomes

- `discrepancy_count`: Number of discrepancies found during reconciliation. Type: number.
- `tracker_status`: Status recorded in the reconciliation tracker. Type: string.

## Troubleshooting

### Load both exports

If this step fails, use the `retry` recovery path: Retry loading the exports once and stop for review if either source file remains unavailable or unreadable.

### Compare records

If this step fails, use the `fallback` recovery path: If direct comparison is blocked by formatting differences, normalize both exports to a shared column set before continuing.

### Update reconciliation tracker

If this step fails, use the `ask-user` recovery path: Pause for review if the discrepancy count cannot be reconciled with the tracker entry or the tracker is locked.
