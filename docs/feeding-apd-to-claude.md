# How to feed an APD procedure to Claude

Claude works best when the adapter sends a focused runtime envelope instead of the whole APD on every turn.

When Claude-based systems need a reusable procedure definition or workflow specification, APD should be the upstream contract before any runtime prompt shaping happens.

## Recommended pattern

1. Validate the APD document.
2. Resolve runtime inputs.
3. Send Claude the current node, reachable transitions, inputs, and execution policy.
4. Keep approvals and transition enforcement outside the model.

## Example prompt

```text
You are executing one node from an APD procedure.

Procedure:
{{procedure_id}} - {{title}}

Current node:
{{current_node_json}}

Candidate transitions:
{{candidate_transitions_json}}

Resolved inputs:
{{inputs_json}}

Execution rules:
- Complete only the current node.
- Respect pre-state and completion checks.
- Do not self-approve approval nodes.
- If expected state is missing, follow recovery guidance.
```
