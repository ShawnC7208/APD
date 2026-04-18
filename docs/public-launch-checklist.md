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

✅ Completed 2026-04-17. Both procedures run through Claude (Anthropic API) via the Strands reference adapter (`adapters/strands/demo/run_apd_with_aer.py`).

| APD | AER schema | APD compare |
|---|---|---|
| `invoice-logging` | PASS | 1 `failed-check` diff — model correctly flagged it could not send the confirmation email in a demo context; node was still marked `completed` by the adapter |
| `refund-escalation-synthesized` | PASS | PASS — 0 differences |

**Adapter rough edges noted:**

- Failed completion checks are recorded but do not halt execution or trigger node recovery in the demo adapter. A production adapter should gate advancement on check results.
- `tool_invocations.outcome` must be exactly `"success"`, `"failure"`, or `"canceled"` — the model returned descriptive sentences on the first run. Prompt tightened and a normalizer added to the demo script.
- Response extraction from `AgentResult` required a fallback path beyond `str(response)` when Strands returns non-text content blocks.
- The demo adapter creates a new `Agent` per node, causing a harmless httpx event-loop cleanup warning on exit. Not a data integrity issue.

**Schema gaps for follow-up:**

- No spec-level guidance on what an adapter must do when a completion check fails (halt vs. proceed vs. trigger recovery). Worth a follow-up spec note.

Comparison is APD-contract-first. Observed-session replay diffing remains future work.

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
