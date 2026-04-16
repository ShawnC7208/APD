# Contributing

## Current priorities

Contributions are most useful in these areas:

- capture-to-APD review ergonomics
- provenance and confidence clarity
- APD to SOP export quality
- execution adapter examples
- realistic synthesized examples and fixtures
- AER feedback based on real execution traces

## Ground rules

- Keep APD focused on procedure definition, not execution receipts.
- Preserve the capture and synthesis framing in docs and examples.
- Put runtime-specific guidance in adapters or exported formats, not in the APD core schema.
- Treat markdown SOPs, Skills, and similar formats as downstream complements, not direct competitors.
- Keep examples realistic and strict-clean under the current validator.

## Before opening a PR

Run the repo checks from the root:

```bash
npm test
npm run publish-smoke
```

Release maintainers can use [`docs/public-launch-checklist.md`](./docs/public-launch-checklist.md) for the remaining publish and announcement steps.

## Suggested contribution areas

- `spec/`: APD and AER spec prose
- `schema/`: JSON Schema changes that match the specs exactly
- `examples/`: realistic observed, synthesized, authored, or converted procedures
- `fixtures/`: validation and export fixtures
- `adapters/`: runtime adapter docs and demo scaffolding
- `packages/sdk-typescript/`: parsing, validation, rendering, and export helpers
- `packages/cli/`: developer workflow commands
