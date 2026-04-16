# Public Launch Checklist

This checklist covers the remaining release-manager tasks after the repo-local automation passes.

## Repo gate

Run these from the repository root:

```bash
npm test
npm run publish-smoke
```

The repo is ready for a quiet public push only after both commands pass.

## npm publish

Publish the scoped packages:

```bash
npm publish --workspace @apd-spec/sdk --access public
npm publish --workspace @apd-spec/cli --access public
```

Package names:

- `@apd-spec/sdk`
- `@apd-spec/cli`

The CLI package provides the stable `apd` command. Launch does not depend on obtaining an unscoped `apd` package name.

## Live runtime validation

Before a broad announcement, run at least these two procedures through a real provider-backed runtime:

- `examples/invoice-logging.apd.json`
- `examples/refund-escalation-synthesized.apd.json`

For each live run:

- save the resulting AER
- note any manual intervention
- note any adapter rough edges
- note any schema gaps worth addressing in a follow-up release

Comparison should stay APD-contract-first. Observed-session replay diffing remains future work.

## GitHub repo metadata

Before promotion beyond a quiet launch, configure the repository on GitHub with:

- description: `Structured procedure definitions for human-reviewable workflows that can be observed, authored, converted, or synthesized before runtime.`
- topics: `apd`, `procedure-definition`, `workflow-specification`, `agent-tooling`, `json-schema`, `sop`, `approval-workflows`, `workflow-automation`, `provenance`
- About links to the README and docs

## Release note highlights

Call out these launch points:

- APD v0.1 spec and schema
- AER v0.1 and preferred AER v0.2 support
- TypeScript SDK: validation, comparison, visualization, and SOP export
- CLI: `apd validate`, `apd info`, `apd export`, `apd visualize`, and `apd aer ...`
- Strands and Claude Skills adapter paths
