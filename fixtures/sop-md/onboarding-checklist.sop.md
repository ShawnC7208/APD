# Employee Onboarding Checklist

<!-- apd-procedure-id: employee-onboarding-checklist -->
<!-- apd-revision: 1 -->
<!-- apd-source-type: converted -->

## Overview

Convert a basic onboarding checklist into an APD graph that coordinates account setup, equipment provisioning, and confirmation.

Use this SOP when:

- A new employee onboarding request has been approved.

Provenance note: This APD was converted from a BPMN onboarding checklist and then normalized into APD node semantics.

## Parameters

- **employee_name** (optional): Name of the employee being onboarded. Type: string.
- **start_date** (optional): Employee start date. Type: string. Format: date.

## Steps

### 1. Create core accounts

<!-- apd-node step_1 observed_vs_inferred: authored -->
Create the employee's email, chat, and HR system accounts using the approved onboarding request.

**Constraints:**
- You SHOULD complete this action before moving on.
- You MUST verify that core accounts exist for the new employee before advancing.
- You SHOULD use the declared parameters exactly as provided: `employee_name`, `start_date`.

### 2. Prepare equipment

<!-- apd-node step_2 observed_vs_inferred: authored -->
Reserve and configure the employee laptop and required accessories.

**Constraints:**
- You SHOULD complete this action before moving on because it is medium risk and provisioning changes asset assignment but can be corrected.
- You MUST verify that assigned equipment is ready for handoff before advancing.

### 3. Confirm onboarding packet

<!-- apd-node approval_1 observed_vs_inferred: authored -->
Stop and request approval for this gate: HR confirms that all onboarding steps are complete before notifying the new employee.
<!-- apd-transition approval_1->step_3 observed_vs_inferred: authored -->

**Constraints:**
- You MUST stop and request approval before proceeding because HR confirms that all onboarding steps are complete before notifying the new employee.
- After approval is granted, You MUST continue to **Send readiness confirmation**.

### 4. Send readiness confirmation

<!-- apd-node step_3 observed_vs_inferred: authored -->
Send the onboarding readiness confirmation to the employee and hiring manager.

**Constraints:**
- You MUST complete this action before moving on because it is high risk, irreversible, requires confirmation and sending the confirmation affects external communication timing.
- You MUST verify that the readiness confirmation has been sent before advancing.
- You MUST request explicit confirmation before taking this action because sending the confirmation affects external communication timing.
- You MUST NOT proceed without confirmed intent because sending the confirmation affects external communication timing.

## Outcomes

<!-- apd-node done observed_vs_inferred: authored -->
### Onboarding preparation complete

- Outcome: `success`
- APD terminal node: `done`

## Examples

### Example invocation

```yaml
employee_name: <string>
start_date: <string>
```

### Expected outcomes

- `account_status`: Status of account provisioning. Type: string.
- `equipment_status`: Status of equipment readiness. Type: string.

## Troubleshooting

### Create core accounts

If this step fails, use the `ask-user` recovery path: Pause for review if account data conflicts across systems or an account already exists unexpectedly.

### Prepare equipment

If this step fails, use the `fallback` recovery path: If the preferred hardware is unavailable, reserve the standard backup device and record the exception for follow-up.

### Send readiness confirmation

If this step fails, use the `abort` recovery path: Do not send the confirmation until the recipients, equipment status, and start date are verified.
