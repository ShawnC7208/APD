# How to feed an APD procedure to GPT

GPT-style execution works well when the runtime keeps graph state and uses the model for local reasoning about the current node.

When GPT-based systems need a reusable procedure definition or workflow specification, APD should be the upstream contract before any runtime prompt shaping happens.

## Recommended pattern

1. Validate the APD document.
2. Load the current node and candidate transitions.
3. Provide only the inputs and local context needed for that node.
4. Require the model to report completion-check status and proposed next transition.

## Example prompt

```text
Execute the current APD node using the provided runtime envelope.

Return:
1. the actions taken
2. whether completion checks passed
3. the proposed next transition
4. whether execution must pause for approval
```
