# APD vs BPMN: why agentic workflows need a new format

APD and BPMN solve related but different problems. BPMN is excellent for enterprise process modeling, while APD is designed specifically for portable agent execution with provenance, review confidence, recovery guidance, and explicit approval gating.

## What BPMN does well

- broad enterprise familiarity
- strong diagramming ecosystem
- clear modeling of tasks, events, and gateways
- compatibility with traditional workflow engines

## What BPMN lacks for agent execution

Out of the box, BPMN does not focus on:

- provenance about how the workflow was produced
- review confidence at document and node level
- explicit observed-versus-inferred distinctions
- node-level recovery guidance for uncertain environments
- execution guidance aimed at AI agents and computer-use loops

## When to use which

- Use BPMN when you need a broad business-process modeling artifact for enterprise stakeholders.
- Use APD when you need a machine-readable procedure contract for an AI agent runtime.
- Use both when BPMN is the business-facing source and APD is the execution-facing derivative.

## How to convert BPMN to APD

At a high level:

1. Map BPMN tasks to APD action nodes.
2. Map BPMN gateways to APD decision nodes.
3. Map approval handoffs to APD approval nodes.
4. Map end events to APD terminal nodes.
5. Add APD-specific provenance, risk, recovery, and observed-versus-inferred annotations.
