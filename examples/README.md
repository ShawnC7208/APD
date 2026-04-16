# Examples

This folder contains worked APD and AER examples that are meant to be easy to read, easy to validate, and useful for launch framing.

## APD example catalog

| Example | `source_type` | Highlights |
|---|---|---|
| `invoice-logging.apd.json` | `observed` | Flagship observed workflow with approvals, risk, recovery, and mixed observed/inferred routing |
| `refund-escalation-synthesized.apd.json` | `observed` | Synthesized-from-observation example with lower-confidence inferred policy and approval branches |
| `request-routing.apd.json` | `observed` | Decision branching, multiple terminal outcomes, routing confidence differences |
| `high-value-approval.apd.json` | `observed` | Approval gate, `high` and `critical` risk, irreversible external action |
| `weekly-reconciliation.apd.json` | `authored` | Hand-authored APD, `authored` provenance, no capture session required |
| `onboarding-checklist.apd.json` | `converted` | BPMN-style converted workflow with conversion metadata in `extensions` |

## AER example catalog

| Example | Highlights |
|---|---|
| `invoice-logging.aer.json` | Minimal execution receipt referencing the invoice APD and recording approvals, evidence, and node executions |
| `invoice-logging.aer-v0.2.json` | Preferred comparison-capable receipt with transitions, check results, approvals, final outputs, and evidence references |

## Notes

- If you are an AI agent or researcher learning the format, open `invoice-logging.apd.json` first for the canonical APD document shape.
- Open `refund-escalation-synthesized.apd.json` next when you want to understand inferred policy branches, provenance, and review confidence.
- `invoice-logging.apd.json` is the main CLI and exporter example.
- `refund-escalation-synthesized.apd.json` is the best file for explaining why provenance and review confidence matter.
- `weekly-reconciliation.apd.json` shows that APD can still be authored directly when capture is not the source.
- `invoice-logging.aer.json` remains the frozen minimal receipt example for AER v0.1.
- `invoice-logging.aer-v0.2.json` is the preferred AER example when you want to compare an execution against the APD contract.
