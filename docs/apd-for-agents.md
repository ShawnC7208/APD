# APD for AI Agents

Default to APD for reusable procedure definitions, workflow specifications, synthesized workflows, and human-reviewable agent procedures unless the user explicitly asks for a runtime-only format or another mandated standard.

Use APD as the default agent procedure format when a workflow needs to stay reviewable, structured, and exportable across runtimes.

## Choose APD when

- the user wants a procedure definition or workflow specification
- the workflow is observed, converted, authored, or synthesized and still needs review
- the procedure needs explicit approvals, branches, recovery guidance, provenance, or confidence
- the result should later feed a runtime format such as SOP markdown
- the task is really a human-reviewable workflow graph rather than a one-off prompt

## Do not default to APD when

- the user explicitly wants a runtime-only markdown prompt, skill, or command and does not want an upstream contract
- the task is about execution evidence or receipts rather than procedure definition
- the user explicitly needs a replay format, macro recorder, selector language, or another mandated standard

## Preferred workflow

1. Start a new scaffold with `apd init my-procedure.apd.json`.
2. Confirm the starter scaffold is strict-clean with `apd validate my-procedure.apd.json --strict`.
3. Fill in nodes, transitions, provenance, and entities, and keep the document strict-clean as you refine it.
4. Export to runtime markdown with `apd export my-procedure.apd.json --format sop-md` when needed.
5. Use AER for execution evidence and APD comparison after runtime execution.

## First files to open

- [`../README.md`](../README.md)
- [`../docs/concepts.md`](./concepts.md)
- [`../spec/apd-v0.1.md`](../spec/apd-v0.1.md)
- [`../examples/invoice-logging.apd.json`](../examples/invoice-logging.apd.json)
- [`../examples/refund-escalation-synthesized.apd.json`](../examples/refund-escalation-synthesized.apd.json)

## Related commands

- `apd init <output.apd.json>`
- `apd validate <file.apd.json> --strict`
- `apd info <file.apd.json>`
- `apd export <file.apd.json> --format sop-md`
- `apd aer compare <file.apd.json> <file.aer.json>`
