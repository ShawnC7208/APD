# Capture to APD

This is the launch story APD is optimized for, while still allowing the upstream source material to come from direct observation, existing procedural documents, or synthesized automation intent.

## The flow

1. A capture or synthesis system gathers workflow source material from observation, procedural docs, or automation intent.
2. A synthesizer turns that source material into an APD graph.
3. Reviewers inspect the APD, focusing on inferred or low-confidence nodes.
4. The approved APD is exported to runtime markdown.
5. An adapter executes the runtime format.
6. AER records what happened during execution.

## Why the capture story matters

If you only look at the runtime markdown, you lose the part reviewers care about most:

- what the human actually did
- where the synthesizer generalized
- which branches were guessed from policy or context
- where approval gates were introduced to make the procedure safe

That is why APD exists upstream of SOP markdown.

## Walkthrough

Use [`../examples/refund-escalation-synthesized.apd.json`](../examples/refund-escalation-synthesized.apd.json) as the launch example.

### Observation

The captured session showed:

- a support agent reading a refund ticket
- the agent opening the order admin tool
- the final customer response

### Synthesis

The synthesizer then added procedure structure:

- a policy threshold decision
- a supervisor approval gate
- a denial branch for non-approved refunds

Those are valuable runtime controls, but they were not all directly observed. APD marks that explicitly with `observed_vs_inferred`.

### Review

The reviewer can immediately focus on:

- `decision_1`
- `approval_1`
- `step_3`

because their per-node confidence is lower than the directly observed steps.

### Export

Once approved, the APD can be exported:

```bash
apd export examples/refund-escalation-synthesized.apd.json --format sop-md
```

The runtime markdown stays readable, while HTML comments preserve the APD provenance markers for debugging.

### Execute

From there, use one of the launch adapters:

- [`../adapters/strands`](../adapters/strands)
- [`../adapters/claude-skills`](../adapters/claude-skills)

### Record

Execution facts belong in AER, not APD:

- [`../spec/agent-execution-record-aer.md`](../spec/agent-execution-record-aer.md)
- [`../spec/agent-execution-record-aer-v0.2.md`](../spec/agent-execution-record-aer-v0.2.md)
- [`../examples/invoice-logging.aer.json`](../examples/invoice-logging.aer.json)
- [`../examples/invoice-logging.aer-v0.2.json`](../examples/invoice-logging.aer-v0.2.json)

Use AER v0.2 when you want to compare a run against the APD contract. That comparison is about APD conformance first, not replaying the original capture session.

## The key launch claim

APD is interesting because it preserves the review surface that runtime markdown normally throws away.
