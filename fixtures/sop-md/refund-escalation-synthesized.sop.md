# Refund Escalation from Observed Support Session

<!-- apd-procedure-id: refund-escalation-synthesized -->
<!-- apd-revision: 1 -->
<!-- apd-source-type: observed -->

## Overview

Review a refund ticket, determine whether it is within policy, request approval when needed, and send the customer resolution.

Use this SOP when:

- A refund request ticket is open and the relevant order is available for review.

Provenance note: Ticket review, order lookup, and customer messaging were directly observed. Policy threshold routing, supervisor approval logic, and the denial branch were inferred during synthesis and intentionally left with lower review confidence.

## Parameters

- **ticket_id** (optional): Identifier for the support ticket under review. Type: string.
- **order_id** (optional): Identifier for the customer order tied to the refund request. Type: string.
- **customer_email** (optional): Customer email address used for the final resolution message. Type: string. Format: email.
- **refund_amount** (optional): Requested refund amount from the captured session. Type: number.

## Steps

### 1. Review refund ticket

<!-- apd-node step_1 observed_vs_inferred: observed -->
Open the refund ticket, read the customer request, and confirm the refund amount, order ID, and customer email.
This step produces `order_id`, `customer_email`, `refund_amount`.

**Constraints:**
- You SHOULD complete this action before moving on.
- You MUST verify that the refund amount, order ID, and customer email are visible from the ticket before advancing.
- You SHOULD use the declared parameters exactly as provided: `ticket_id`.

### 2. Check order history

<!-- apd-node step_2 observed_vs_inferred: observed -->
Open the order in the admin tool and verify that the order is eligible for refund handling.
This step produces `order_status`.

**Constraints:**
- You SHOULD complete this action before moving on.
- You MUST confirm that the support ticket is open and the order ID is known before starting this step.
- You MUST verify that the order status and refund eligibility context are visible before advancing.
- You SHOULD use the declared parameters exactly as provided: `order_id`.

### 3. Refund within policy threshold?

<!-- apd-node decision_1 observed_vs_inferred: inferred -->
Evaluate the decision question: Is the refund request within the auto-approval policy and consistent with the observed order status?

**Decision paths:**
- If `refund is within policy threshold`, continue to **Issue refund**.
<!-- apd-transition decision_1->step_3 observed_vs_inferred: inferred -->
- If `refund exceeds policy threshold or order context is ambiguous`, continue to **Request supervisor approval**.
<!-- apd-transition decision_1->approval_1 observed_vs_inferred: inferred -->

**Constraints:**
- You MUST evaluate this question before selecting a path: Is the refund request within the auto-approval policy and consistent with the observed order status?
- You SHOULD use this evaluation hint: Compare the requested refund amount and order status against the refund policy threshold that support agents normally follow.
- If `refund is within policy threshold`, You MUST continue to **Issue refund**.
- If `refund exceeds policy threshold or order context is ambiguous`, You MUST continue to **Request supervisor approval**.

### 4. Request supervisor approval

<!-- apd-node approval_1 observed_vs_inferred: inferred -->
Stop and request approval for this gate: Refunds outside the policy threshold require explicit supervisor approval before issuing the refund.

**Approval outcomes:**
- If `approval granted`, continue to **Issue refund**.
<!-- apd-transition approval_1->step_3 observed_vs_inferred: inferred -->
- If `approval denied`, continue to **Refund paused pending approval**.
<!-- apd-transition approval_1->not_approved observed_vs_inferred: inferred -->

**Constraints:**
- You MUST stop and request approval before proceeding because refunds outside the policy threshold require explicit supervisor approval before issuing the refund.
- If `approval granted`, You MUST continue to **Issue refund**.
- If `approval denied`, You MUST continue to **Refund paused pending approval**.

### 5. Issue refund

<!-- apd-node step_3 observed_vs_inferred: inferred -->
Issue the refund in the order admin tool and record the resulting refund status.
This step produces `refund_status`.

**Constraints:**
- You MUST complete this action before moving on because it is high risk, requires confirmation and issuing a refund changes a customer-facing financial record.
- You MUST verify that the refund is recorded in the order admin tool before advancing.
- You MUST request explicit confirmation before taking this action because issuing a refund changes a customer-facing financial record.
- You SHOULD use the declared parameters exactly as provided: `order_id`, `refund_amount`.

### 6. Send customer resolution

<!-- apd-node step_4 observed_vs_inferred: observed -->
Send the customer a reply that confirms the refund outcome and any next steps.

**Constraints:**
- You MUST complete this action before moving on because it is medium risk, irreversible, requires confirmation and the outbound resolution message commits the support team to the communicated refund outcome.
- You MUST verify that the customer-facing resolution message is ready to send and reflects the final refund status before advancing.
- You MUST request explicit confirmation before taking this action because the outbound resolution message commits the support team to the communicated refund outcome.
- You MUST NOT proceed without confirmed intent because the outbound resolution message commits the support team to the communicated refund outcome.
- You SHOULD use the declared parameters exactly as provided: `customer_email`, `refund_status`.

## Outcomes

<!-- apd-node done observed_vs_inferred: observed -->
### Refund handled

- Outcome: `success`
- APD terminal node: `done`

<!-- apd-node not_approved observed_vs_inferred: inferred -->
### Refund paused pending approval

- Outcome: `canceled`
- APD terminal node: `not_approved`

## Examples

### Example invocation

```yaml
ticket_id: <string>
order_id: <string>
customer_email: <string>
refund_amount: <number>
```

### Expected outcomes

- `refund_status`: Final refund disposition recorded for the ticket. Type: string.
- `resolution_message_sent`: Whether the customer resolution message was sent. Type: boolean.

## Troubleshooting

### Review refund ticket

If this step fails, use the `ask-user` recovery path: Pause for review if the ticket does not clearly identify the refund amount, order, or customer contact details.

### Check order history

If this step fails, use the `retry` recovery path: Retry the order lookup once and stop for review if the order still cannot be opened or matched.

### Issue refund

If this step fails, use the `abort` recovery path: Do not issue the refund if the order, amount, or approval state cannot be verified confidently.

### Send customer resolution

If this step fails, use the `ask-user` recovery path: Pause for review if the final refund status is unclear or the customer response needs a non-standard explanation.
