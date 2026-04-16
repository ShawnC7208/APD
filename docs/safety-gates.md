# Safety gates and approval nodes in APD

APD treats safety controls as part of the procedure contract rather than leaving them implicit in runtime policy.

## Approval nodes

Use an `approval` node when a human must explicitly confirm the next step before execution can continue.

Typical cases:

- external communication
- financial commitments
- sensitive data access
- policy exceptions

## Risk model

`risk` helps a runtime decide how carefully to execute a node.

- `low`: minor impact and easily reversible
- `medium`: moderate impact and reversible with effort
- `high`: significant impact and difficult to reverse
- `critical`: severe impact, irreversible, or materially affects external parties

## Recovery strategies

- `retry`: try again
- `ask-user`: pause and ask for guidance
- `skip`: skip the node
- `abort`: stop execution
- `fallback`: use alternate instructions in `recovery.instructions`

Approval nodes, `risk.confirmation_required`, and `completion_checks` should all be enforced by the adapter, not delegated to the model.
