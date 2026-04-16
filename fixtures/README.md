# Fixtures

This folder contains APD validator fixtures, AER validator fixtures, comparison fixtures, and SOP export snapshot fixtures.

## Valid APD fixtures

- `valid/minimal.apd.json`: smallest valid APD document with a single terminal node
- `valid/full-featured.apd.json`: covers a broad range of optional fields in a single document
- `valid/observed-missing-capture-scope.apd.json`: observed APD that remains valid but should emit provenance warnings
- `valid/reachability-warning.apd.json`: schema-valid APD with an unreachable node, expected to emit a graph warning

## Invalid APD fixtures

- `invalid/missing-kind.apd.json`: missing the top-level `kind` field
- `invalid/bad-node-type.apd.json`: uses an unsupported node `type`
- `invalid/bad-risk-level.apd.json`: uses an unsupported `risk.level`
- `invalid/missing-terminal.apd.json`: missing a terminal node
- `invalid/bad-transition-ref.apd.json`: transition points at a missing node
- `invalid/terminal-missing-outcome.apd.json`: terminal node omits required `outcome`
- `invalid/decision-missing-question.apd.json`: decision node omits required `question`
- `invalid/approval-missing-reason.apd.json`: approval node omits required `reason`
- `invalid/approval-false.apd.json`: approval node sets `approval_required` to `false`
- `invalid/cyclic-graph.apd.json`: contains a back-edge that forms a cycle
- `invalid/multiple-defaults.apd.json`: a single source node has more than one transition with `default: true`

Expected validator behavior:

- All files under `valid/` should pass (some emit warnings — see above).
- All files under `invalid/` should fail.
- `valid/reachability-warning.apd.json` should pass with a graph warning about an unreachable node.
- `valid/observed-missing-capture-scope.apd.json` should pass with provenance warnings about missing observed metadata.

## SOP export fixtures

`sop-md/` contains the checked-in markdown snapshots generated from every APD example with `toSopMarkdown`.

Those fixtures are used to keep the exporter deterministic and to make doc examples easy to inspect without rerunning the exporter first.

## AER fixtures

- `aer/invalid/dangling-evidence.aer-v0.2.json`: references undeclared evidence
- `aer/invalid/invalid-transition.aer-v0.2.json`: records a transition to a node that was never executed
- `aer/invalid/malformed-approval-decision.aer-v0.2.json`: uses an unsupported approval decision value
- `aer/compare/procedure-mismatch.aer-v0.2.json`: valid AER v0.2 receipt that should fail APD conformance comparison
