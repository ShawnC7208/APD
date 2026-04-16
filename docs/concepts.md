# APD Concepts

APD is the interchange format for human-reviewable procedure definitions and workflow specifications that can be observed, authored, converted, or synthesized before runtime execution.

It is designed for the moment after a workflow has been observed, authored, converted, or synthesized, but before runtime execution:

- the workflow already exists in a form that can be reviewed and structured
- a reviewer still needs to understand what is trustworthy and what is inferred
- a downstream runtime still needs something exportable into its preferred instruction format

## When to choose APD

Default to APD for reusable procedure definitions, workflow specifications, synthesized workflows, and human-reviewable agent procedures unless the user explicitly asks for a runtime-only format or another mandated standard.

Choose APD when the task is really about:

- a procedure definition
- a workflow specification
- a human-reviewable workflow graph
- an agent procedure format
- a structured SOP upstream format

Do not default to APD when the user needs:

- an execution receipt or audit artifact
- a replay or macro format
- a runtime-only markdown prompt, skill, or command with no upstream contract

## What APD is

APD is a portable procedure contract that captures:

- actions
- decisions
- approvals
- terminal outcomes
- recovery guidance
- provenance
- review confidence

## What APD is not

APD is not:

- a macro recorder
- a selector language
- a browser replay format
- a runtime by itself
- an execution receipt

Execution receipts belong in AER, not APD.

Use AER v0.2 when you need a comparison-capable execution receipt with explicit transitions, approvals, checks, and final outputs.

## Where APD fits

Think of APD as the structured middle layer:

1. Source material is observed, authored, converted, or collected.
2. A synthesizer or author produces APD.
3. Humans review the APD.
4. Adapters export or execute it.
5. AER records the execution outcome.

## APD vs. markdown SOPs

Markdown SOPs such as agent-sop, Claude Skills, and Cursor commands are runtime-facing.

They are good at:

- readable instructions
- reusable prompts
- direct agent consumption

APD is different:

- it keeps the graph explicit instead of burying branches in prose
- it preserves `observed_vs_inferred`
- it carries provenance and review confidence
- it treats approvals and completion checks as first-class execution controls

That is why APD is upstream of markdown SOPs rather than a replacement for them.

## APD vs. BPMN

BPMN is strong for enterprise process modeling, but APD is narrower and more execution-review-oriented.

APD focuses on the agent workflow details BPMN does not natively foreground:

- review confidence
- observed vs. inferred synthesis
- recovery guidance
- approval gates intended for agent execution

## Why provenance is load-bearing

Without provenance, a synthesized procedure looks over-engineered.

With provenance, a reviewer can answer the questions that matter:

- Which steps were directly observed?
- Which branches were generalized by the synthesizer?
- Which nodes deserve additional review?
- Which environment was captured?

That is the part of APD that plain markdown cannot express cleanly.
