# Log Invoice to Tracker

<!-- apd-procedure-id: log-invoice-to-tracker -->
<!-- apd-revision: 1 -->
<!-- apd-source-type: observed -->

## Overview

Extract invoice data from an email, update the tracker, and confirm receipt.

Use this SOP when:

- An invoice email arrives for review.

Provenance note: Core actions were observed from the recording. Approval and threshold routing were inferred from risk and workflow structure.

## Parameters

- **vendor_name** (optional): The vendor name extracted from the invoice email. Type: string.
- **invoice_amount** (optional): The invoice amount extracted from the invoice email. Type: number.
- **approval_threshold** (optional, default: 5000): Finance approval threshold used to decide whether explicit approval is required. Type: number.
- **sender_email** (optional): The sender of the invoice email. Type: string. Format: email.

## Steps

### 1. Read invoice email

<!-- apd-node step_1 observed_vs_inferred: observed -->
Open the invoice email and identify the vendor name, invoice amount, and sender email.
This step produces `vendor_name`, `invoice_amount`, `sender_email`.

**Constraints:**
- You SHOULD complete this action before moving on.
- You MUST verify that the vendor name, amount, and sender email have been identified before advancing.

### 2. Open tracker

<!-- apd-node step_2 observed_vs_inferred: observed -->
Open the invoice tracker workbook in Excel.

**Constraints:**
- You SHOULD complete this action before moving on.
- You MUST verify that the tracker workbook is open and visible before advancing.

### 3. Update tracker row

<!-- apd-node step_3 observed_vs_inferred: observed -->
Find the next empty row and enter the vendor name and invoice amount.
This step produces `tracker_row`.

**Constraints:**
- You SHOULD complete this action before moving on because it is medium risk and spreadsheet edits are reversible before save.
- You MUST confirm that the tracker workbook is open before starting this step.
- You MUST verify that the vendor name and amount appear in the selected row before advancing.
- You SHOULD use the declared parameters exactly as provided: `vendor_name`, `invoice_amount`.

### 4. Amount above approval threshold?

<!-- apd-node decision_1 observed_vs_inferred: inferred -->
Evaluate the decision question: Is the invoice amount above the approval threshold?

**Decision paths:**
- If `invoice_amount <= approval_threshold`, continue to **Draft confirmation reply**.
<!-- apd-transition decision_1->step_4 observed_vs_inferred: inferred -->
- If `invoice_amount > approval_threshold`, continue to **Get finance approval**.
<!-- apd-transition decision_1->approval_1 observed_vs_inferred: inferred -->

**Constraints:**
- You MUST evaluate this question before selecting a path: Is the invoice amount above the approval threshold?
- You SHOULD use this evaluation hint: Compare the extracted invoice amount with the declared approval_threshold value.
- If `invoice_amount <= approval_threshold`, You MUST continue to **Draft confirmation reply**.
- If `invoice_amount > approval_threshold`, You MUST continue to **Get finance approval**.

### 5. Get finance approval

<!-- apd-node approval_1 observed_vs_inferred: inferred -->
Stop and request approval for this gate: High-value invoices require explicit approval before sending confirmation.
<!-- apd-transition approval_1->step_4 observed_vs_inferred: inferred -->

**Constraints:**
- You MUST stop and request approval before proceeding because high-value invoices require explicit approval before sending confirmation.
- After approval is granted, You MUST continue to **Draft confirmation reply**.

### 6. Draft confirmation reply

<!-- apd-node step_4 observed_vs_inferred: inferred -->
Prepare a reply confirming that the invoice was updated in the tracker.

**Constraints:**
- You SHOULD complete this action before moving on.
- You MUST verify that a confirmation reply draft is ready before advancing.
- You SHOULD use the declared parameters exactly as provided: `sender_email`.

### 7. Confirm external reply

<!-- apd-node approval_2 observed_vs_inferred: inferred -->
Stop and request approval for this gate: This action sends an email to an external party.
<!-- apd-transition approval_2->step_5 observed_vs_inferred: inferred -->

**Constraints:**
- You MUST stop and request approval before proceeding because this action sends an email to an external party.
- After approval is granted, You MUST continue to **Send reply**.

### 8. Send reply

<!-- apd-node step_5 observed_vs_inferred: observed -->
Send the confirmation reply.

**Constraints:**
- You MUST complete this action before moving on because it is high risk, irreversible, requires confirmation and sending the email affects an external party.
- You MUST verify that the confirmation email has been sent before advancing.
- You MUST request explicit confirmation before taking this action because sending the email affects an external party.
- You MUST NOT proceed without confirmed intent because sending the email affects an external party.

## Outcomes

<!-- apd-node done observed_vs_inferred: inferred -->
### Procedure completed

- Outcome: `success`
- APD terminal node: `done`

## Examples

### Example invocation

```yaml
vendor_name: <string>
invoice_amount: <number>
approval_threshold: <number>
sender_email: <string>
```

### Expected outcomes

- `tracker_row`: The row in the tracker that was updated. Type: string.
- `confirmation_sent`: Whether the confirmation reply was sent. Type: string.

## Troubleshooting

### Read invoice email

If this step fails, use the `ask-user` recovery path: Pause and ask the user if any required invoice detail is missing, ambiguous, or unreadable.

### Open tracker

If this step fails, use the `retry` recovery path: Retry opening the workbook once and stop for review if the tracker file still cannot be opened.

### Update tracker row

If this step fails, use the `ask-user` recovery path: If a valid row cannot be located confidently, pause and ask the user which row to use.

### Draft confirmation reply

If this step fails, use the `ask-user` recovery path: Ask the user for direction if a clear confirmation draft cannot be prepared from the available invoice details.

### Send reply

If this step fails, use the `abort` recovery path: Do not send the email if the recipient, approval state, or final draft cannot be verified confidently.
