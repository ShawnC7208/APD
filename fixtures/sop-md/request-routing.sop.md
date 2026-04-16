# Route Incoming Support Request

<!-- apd-procedure-id: route-support-request -->
<!-- apd-revision: 1 -->
<!-- apd-source-type: observed -->

## Overview

Review a new support request, determine its priority, and route it to the correct queue.

Use this SOP when:

- A new support request appears in the intake queue.

Provenance note: Ticket review and queue assignment were observed. Urgency classification logic was inferred from the routing outcome and playbook guidance.

## Parameters

- **ticket_id** (optional): Unique identifier for the incoming support request. Type: string.
- **request_text** (optional): The request body submitted by the user. Type: string.

## Steps

### 1. Open the intake ticket

<!-- apd-node step_1 observed_vs_inferred: observed -->
Open the new support request and review the subject, request text, and requester account details.
This step produces `request_text`.

**Constraints:**
- You SHOULD complete this action before moving on.
- You MUST verify that the ticket details are visible and ready for review before advancing.
- You SHOULD use the declared parameters exactly as provided: `ticket_id`.

### 2. Capture routing context

<!-- apd-node step_2 observed_vs_inferred: observed -->
Identify any severity indicators, affected product area, and customer impact described in the request.

**Constraints:**
- You SHOULD complete this action before moving on.
- You MUST verify that severity indicators and product area have been noted before advancing.
- You SHOULD use the declared parameters exactly as provided: `request_text`.

### 3. Is this request urgent?

<!-- apd-node decision_1 observed_vs_inferred: inferred -->
Evaluate the decision question: Does the request indicate production impact, security risk, or executive escalation?

**Decision paths:**
- If `Request is routine and does not require immediate escalation`, continue to **Route to standard queue**.
<!-- apd-transition decision_1->step_3 observed_vs_inferred: inferred -->
- If `Request indicates urgent impact or escalation criteria`, continue to **Route to urgent queue**.
<!-- apd-transition decision_1->step_4 observed_vs_inferred: inferred -->

**Constraints:**
- You MUST evaluate this question before selecting a path: Does the request indicate production impact, security risk, or executive escalation?
- You SHOULD use this evaluation hint: Treat outages, security incidents, and blocked revenue workflows as urgent.
- If `Request is routine and does not require immediate escalation`, You MUST continue to **Route to standard queue**.
- If `Request indicates urgent impact or escalation criteria`, You MUST continue to **Route to urgent queue**.

### 4. Route to standard queue

<!-- apd-node step_3 observed_vs_inferred: observed -->
Assign the request to the standard support queue and note the selected priority.
This step produces `assigned_queue`, `priority`.

**Constraints:**
- You SHOULD complete this action before moving on because it is low risk and queue assignment can be changed later if needed.
- You MUST verify that the request is assigned to Standard Support with a non-urgent priority before advancing.

### 5. Route to urgent queue

<!-- apd-node step_4 observed_vs_inferred: inferred -->
Assign the request to the urgent escalation queue and mark it for immediate follow-up.
This step produces `assigned_queue`, `priority`.

**Constraints:**
- You SHOULD complete this action before moving on because it is medium risk and urgent routing changes queue ownership and response expectations.
- You MUST verify that the request is assigned to Urgent Escalations with urgent priority before advancing.

## Outcomes

<!-- apd-node done_standard observed_vs_inferred: observed -->
### Routed to standard queue

- Outcome: `success`
- APD terminal node: `done_standard`

<!-- apd-node done_escalated observed_vs_inferred: inferred -->
### Escalated for urgent handling

- Outcome: `success`
- APD terminal node: `done_escalated`

## Examples

### Example invocation

```yaml
ticket_id: <string>
request_text: <string>
```

### Expected outcomes

- `assigned_queue`: The queue selected for follow-up. Type: string.
- `priority`: The priority chosen during triage. Type: string.

## Troubleshooting

### Open the intake ticket

If this step fails, use the `retry` recovery path: Retry loading the ticket once and stop for review if the intake record still cannot be opened.

### Capture routing context

If this step fails, use the `ask-user` recovery path: Ask the user for direction if severity, impact, or product area cannot be determined confidently from the ticket.

### Route to standard queue

If this step fails, use the `retry` recovery path: Retry the queue assignment once and stop for review if the ticket still cannot be routed to the standard queue.

### Route to urgent queue

If this step fails, use the `fallback` recovery path: If the urgent queue is unavailable, record the urgent status and escalate to the on-call workflow for immediate follow-up.
