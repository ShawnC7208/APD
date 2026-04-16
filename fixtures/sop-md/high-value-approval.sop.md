# Process High-Value Purchase Order

<!-- apd-procedure-id: process-high-value-purchase-order -->
<!-- apd-revision: 1 -->
<!-- apd-source-type: observed -->

## Overview

Validate a high-value purchase order, obtain approval, and submit it to the vendor.

Use this SOP when:

- A purchase order above the manager review threshold is ready for processing.

Provenance note: Record review, budget validation, approval gating, and vendor submission were observed. Failure and denial handling was inferred from policy and workflow context.

## Parameters

- **purchase_order_id** (optional): Identifier for the purchase order. Type: string.
- **vendor_name** (optional): Vendor receiving the order. Type: string.
- **total_amount** (optional): Total value of the purchase order. Type: number.

## Steps

### 1. Open purchase order

<!-- apd-node step_1 observed_vs_inferred: observed -->
Open the purchase order record and review the vendor, amount, and requested items.

**Constraints:**
- You SHOULD complete this action before moving on.
- You MUST verify that the purchase order details are visible before advancing.
- You SHOULD use the declared parameters exactly as provided: `purchase_order_id`.

### 2. Verify budget availability

<!-- apd-node step_2 observed_vs_inferred: observed -->
Check the department budget ledger and confirm that sufficient budget remains for the purchase order.

**Constraints:**
- You SHOULD complete this action before moving on because it is medium risk and budget review influences downstream approval but does not change external state.
- You MUST verify that available budget has been checked against the order total before advancing.
- You SHOULD use the declared parameters exactly as provided: `total_amount`.

### 3. Is budget sufficient?

<!-- apd-node decision_1 observed_vs_inferred: inferred -->
Evaluate the decision question: Does the department budget cover the full order amount?

**Decision paths:**
- If `Budget is sufficient for the order`, continue to **Get manager approval**.
<!-- apd-transition decision_1->approval_1 observed_vs_inferred: inferred -->
- If `Budget is insufficient or cannot be confirmed`, continue to **Record approval block**.
<!-- apd-transition decision_1->step_4 observed_vs_inferred: inferred -->

**Constraints:**
- You MUST evaluate this question before selecting a path: Does the department budget cover the full order amount?
- You SHOULD use this evaluation hint: Compare available budget with total_amount after reserving mandatory commitments.
- If `Budget is sufficient for the order`, You MUST continue to **Get manager approval**.
- If `Budget is insufficient or cannot be confirmed`, You MUST continue to **Record approval block**.

### 4. Get manager approval

<!-- apd-node approval_1 observed_vs_inferred: observed -->
Stop and request approval for this gate: High-value orders require explicit manager approval before vendor submission.

**Approval outcomes:**
- If `Manager approval granted`, continue to **Submit order to vendor**.
<!-- apd-transition approval_1->step_3 observed_vs_inferred: observed -->
- If `Manager approval denied or deferred`, continue to **Record approval block**.
<!-- apd-transition approval_1->step_4 observed_vs_inferred: inferred -->

**Constraints:**
- You MUST stop and request approval before proceeding because high-value orders require explicit manager approval before vendor submission.
- If `Manager approval granted`, You MUST continue to **Submit order to vendor**.
- If `Manager approval denied or deferred`, You MUST continue to **Record approval block**.

### 5. Submit order to vendor

<!-- apd-node step_3 observed_vs_inferred: observed -->
Submit the approved purchase order to the vendor using the procurement portal.

**Constraints:**
- You MUST complete this action before moving on because it is critical risk, irreversible, requires confirmation and submitting the order creates an external procurement commitment with the vendor.
- You MUST verify that the procurement portal confirms the order was submitted before advancing.
- You MUST request explicit confirmation before taking this action because submitting the order creates an external procurement commitment with the vendor.
- You MUST NOT proceed without confirmed intent because submitting the order creates an external procurement commitment with the vendor.
- You SHOULD use the declared parameters exactly as provided: `vendor_name`, `purchase_order_id`.

### 6. Record approval block

<!-- apd-node step_4 observed_vs_inferred: inferred -->
Document that the purchase order cannot proceed because budget or approval requirements were not satisfied.

**Constraints:**
- You MUST complete this action before moving on because it is high risk and the status change can stop a purchase order from moving forward until corrected.
- You MUST verify that the purchase order record includes the reason the process stopped before advancing.

## Outcomes

<!-- apd-node done_success observed_vs_inferred: observed -->
### Purchase order submitted

- Outcome: `success`
- APD terminal node: `done_success`

<!-- apd-node done_failure observed_vs_inferred: inferred -->
### Purchase order stopped

- Outcome: `failure`
- APD terminal node: `done_failure`

## Examples

### Example invocation

```yaml
purchase_order_id: <string>
vendor_name: <string>
total_amount: <number>
```

### Expected outcomes

- `approval_status`: Final approval outcome. Type: string.
- `vendor_submission_status`: Status of the vendor submission. Type: string.

## Troubleshooting

### Open purchase order

If this step fails, use the `ask-user` recovery path: Pause for review if the purchase order record cannot be found or key order details are incomplete.

### Verify budget availability

If this step fails, use the `ask-user` recovery path: Ask the user for direction if the ledger is unavailable or the remaining budget cannot be verified confidently.

### Submit order to vendor

If this step fails, use the `abort` recovery path: Stop and report the failure if submission status is unclear or the portal reports an error.

### Record approval block

If this step fails, use the `ask-user` recovery path: Pause for review if the rejection reason is ambiguous.
