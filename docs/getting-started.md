# Getting Started with APD

This guide covers both the published npm install path and the local clone workflow.

## Option A: Install from npm

If you want to use APD without cloning the repo first:

```bash
npm install -g @apd-spec/cli
```

Then create and validate a new APD scaffold locally:

```bash
apd init my-procedure.apd.json
apd validate my-procedure.apd.json --strict
```

Before exporting, replace the scaffold placeholders in `my-procedure.apd.json` with a real summary and at least one real step instruction.

Then export the refined APD to SOP markdown:

```bash
apd export my-procedure.apd.json --format sop-md
```

If you want to build APD tooling programmatically, install the SDK separately:

```bash
npm install @apd-spec/sdk
```

If you want to run the checked-in examples such as `examples/invoice-logging.apd.json`, use the clone workflow below.

## Option B: Work from a local clone

### Prerequisites

- Node.js and npm installed locally
- the APD repo cloned to your machine
- commands run from the repository root

### Step 1: Install dependencies

```bash
npm install
```

### Step 2: Build the workspace packages

```bash
npm run build
```

### Step 3: Create a new APD scaffold

```bash
node packages/cli/bin/apd.js init my-procedure.apd.json
```

This writes a strict-clean minimal procedure definition scaffold.

### Step 4: Validate the scaffolded APD

```bash
node packages/cli/bin/apd.js validate my-procedure.apd.json --strict
```

You should see a `PASS` line with no `WARN` lines for the starter scaffold.

### Step 5: Inspect the flagship example

```bash
node packages/cli/bin/apd.js info examples/invoice-logging.apd.json
```

This prints the procedure id, start node, node counts, and a path preview.

### Step 6: Export the APD to markdown SOP

```bash
node packages/cli/bin/apd.js export my-procedure.apd.json --format sop-md
```

This prints the generated SOP markdown to stdout.

To write a file instead:

```bash
node packages/cli/bin/apd.js export my-procedure.apd.json --format sop-md --output /tmp/my-procedure.sop.md
```

### Step 7: Validate and compare AER

```bash
node packages/cli/bin/apd.js aer validate examples/invoice-logging.aer-v0.2.json --strict
node packages/cli/bin/apd.js aer compare examples/invoice-logging.apd.json examples/invoice-logging.aer-v0.2.json
```

### Step 8: Visualize the graph

```bash
node packages/cli/bin/apd.js visualize examples/invoice-logging.apd.json --format mermaid
node packages/cli/bin/apd.js visualize examples/invoice-logging.apd.json --format svg > /tmp/invoice-logging.svg
```

### Step 9: Run the repo gate

```bash
npm test
```

That runs:

- SDK tests
- CLI tests
- the smoke script across all APD examples and fixtures

### Step 10: Run the publish smoke check

```bash
npm run publish-smoke
```

### Step 11: Follow the capture-to-runtime story

- Read [`./apd-for-agents.md`](./apd-for-agents.md)
- Read [`./capture-to-apd.md`](./capture-to-apd.md)
- Compare APD JSON and SOP markdown in [`./apd-to-sop-example.md`](./apd-to-sop-example.md)
- Inspect [`../adapters/strands`](../adapters/strands) or [`../adapters/claude-skills`](../adapters/claude-skills)
