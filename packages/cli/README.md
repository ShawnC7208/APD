# `@apd-spec/cli`

`@apd-spec/cli` is the command-line interface for creating, validating, comparing, summarizing, visualizing, and exporting APD procedure definitions and AER receipts.

## Install from npm

Install the CLI if you want the `apd` command:

```bash
npm install -g @apd-spec/cli
```

That installs the stable `apd` command:

```bash
apd init my-procedure.apd.json
apd validate my-procedure.apd.json --strict
```

If you are working from a local clone of this repo:

```bash
npm install
npm run build
node packages/cli/bin/apd.js validate examples/invoice-logging.apd.json
```

## Command overview

```text
apd init <output.apd.json> [--title <title>] [--procedure-id <id>] [--summary <summary>] [--source-type observed|authored|converted|generated] [--force]
apd validate <file.apd.json> [--json] [--quiet] [--strict]
apd info <file.apd.json> [--json]
apd export <file.apd.json> --format sop-md [--output <file.sop.md>]
apd visualize <file.apd.json> --format mermaid|svg
apd aer validate <file.aer.json> [--json] [--quiet] [--strict]
apd aer info <file.aer.json> [--json]
apd aer compare <file.apd.json> <file.aer.json> [--json]
```

Compatibility bridge:

```text
apd-validate <file.apd.json> [--json] [--quiet] [--strict]
```

## `validate`

```bash
apd validate my-procedure.apd.json --strict
```

Checkout-based example:

```bash
node packages/cli/bin/apd.js validate examples/invoice-logging.apd.json
```

Behavior:

- exit code `0` when the document has no validation errors
- exit code `1` when schema or graph validation errors exist
- `--quiet` prints nothing and relies on exit code only
- `--strict` adds best-practice warnings without turning warnings into failures

## `init`

```bash
apd init refund-review.apd.json
```

This creates a strict-clean minimal APD scaffold with a starter action node and terminal node.

## `info`

```bash
apd info my-procedure.apd.json
```

This prints the procedure id, start node, node counts, transitions, and a path preview.

Checkout-based example:

```bash
apd info examples/invoice-logging.apd.json
```

## `export`

Print SOP markdown to stdout:

```bash
apd export my-procedure.apd.json --format sop-md
```

Write it to a file:

```bash
apd export my-procedure.apd.json --format sop-md --output /tmp/my-procedure.sop.md
```

The exporter validates the APD first. Invalid APDs fail before any markdown is written.

Checkout-based example:

```bash
apd export examples/invoice-logging.apd.json --format sop-md
```

## `visualize`

```bash
apd visualize my-procedure.apd.json --format mermaid
apd visualize my-procedure.apd.json --format svg > /tmp/my-procedure.svg
```

Checkout-based example:

```bash
apd visualize examples/invoice-logging.apd.json --format mermaid
```

## `aer validate`

```bash
apd aer validate my-procedure.aer-v0.2.json --strict
```

This validates AER v0.1 and v0.2 receipts.

Checkout-based example:

```bash
apd aer validate examples/invoice-logging.aer-v0.2.json --strict
```

## `aer info`

```bash
apd aer info my-procedure.aer-v0.2.json
```

This prints the execution id, referenced procedure, outcome, node count, transition count, approval count, and final output keys.

Checkout-based example:

```bash
apd aer info examples/invoice-logging.aer-v0.2.json
```

## `aer compare`

```bash
apd aer compare my-procedure.apd.json my-procedure.aer-v0.2.json
```

This compares an AER v0.2 receipt against the APD contract and reports structured differences.

Checkout-based example:

```bash
apd aer compare examples/invoice-logging.apd.json examples/invoice-logging.aer-v0.2.json
```

## Related docs

- [`../../docs/getting-started.md`](../../docs/getting-started.md)
- [`../../docs/apd-for-agents.md`](../../docs/apd-for-agents.md)
- [`../../docs/apd-to-sop-example.md`](../../docs/apd-to-sop-example.md)
- [`../../adapters/sop-md-mapping.md`](../../adapters/sop-md-mapping.md)
- [`../sdk-typescript/README.md`](../sdk-typescript/README.md)
