# APD to SOP Example

This page shows the same procedure in two forms:

- APD JSON for review and transformation
- exported SOP markdown for runtime use

## Source APD

The full source file is:

- [`../examples/invoice-logging.apd.json`](../examples/invoice-logging.apd.json)

Excerpt:

```json
{
  "procedure_id": "log-invoice-to-tracker",
  "title": "Log Invoice to Tracker",
  "procedure": {
    "start_node": "step_1",
    "nodes": [
      {
        "id": "decision_1",
        "type": "decision",
        "name": "Amount above approval threshold?",
        "question": "Is the invoice amount above the approval threshold?",
        "evaluation_hint": "Compare the extracted invoice amount with the finance approval threshold.",
        "observed_vs_inferred": "inferred"
      }
    ]
  },
  "provenance": {
    "source_type": "observed",
    "confidence": {
      "overall": 0.89,
      "per_node": [
        { "node_id": "step_1", "confidence": 0.94 },
        { "node_id": "decision_1", "confidence": 0.71 }
      ]
    }
  }
}
```

## Generated SOP markdown

Generate it locally:

```bash
node packages/cli/bin/apd.js export examples/invoice-logging.apd.json --format sop-md
```

Excerpt:

```md
# Log Invoice to Tracker

## Overview

Extract invoice data from an email, update the tracker, and confirm receipt.

## Parameters

- **vendor_name** (optional): The vendor name extracted from the invoice email. Type: string.
- **invoice_amount** (optional): The invoice amount extracted from the invoice email. Type: number.
- **approval_threshold** (optional, default: 5000): Finance approval threshold used to decide whether explicit approval is required. Type: number.

## Steps

### 4. Amount above approval threshold?

<!-- apd-node decision_1 observed_vs_inferred: inferred -->
Evaluate the decision question: Is the invoice amount above the approval threshold?

**Decision paths:**
- If `invoice_amount <= approval_threshold`, continue to **Draft confirmation reply**.
- If `invoice_amount > approval_threshold`, continue to **Get finance approval**.
```

## What changed

The exporter keeps the runtime-friendly structure:

- overview
- parameters
- numbered steps
- troubleshooting

But it still leaves breadcrumbs back to APD:

- HTML comments preserve `observed_vs_inferred`
- APD node structure becomes explicit decision and approval steps
- APD provenance stays upstream, not as noisy runtime prose
