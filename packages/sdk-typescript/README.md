# `@apd-spec/sdk`

`@apd-spec/sdk` is the TypeScript-friendly SDK for creating, validating, summarizing, visualizing, and exporting APD procedure definitions and AER receipts.

## Install from npm

```bash
npm install @apd-spec/sdk
```

Then import it in your project:

```js
const { APD, createApdScaffold, validateApd, validateAer, compareAerToApd, toSopMarkdown } = require("@apd-spec/sdk");
```

If you are working from a local clone of this repo, run:

```bash
npm install
npm run build
```

## Primary exports

Builder:

- `APD`
- `createApdScaffold`

Read and validate:

- `parseApd`
- `parseAer`
- `validateApd`
- `validateAer`
- `summarizeApd`
- `summarizeAer`
- `compareAerToApd`

Render and export:

- `toMermaid`
- `toSvg`
- `toSopMarkdown`

Schema and diagnostics helpers:

- `loadSchema`
- `loadApdSchema`
- `loadAerSchema`
- `graphDiagnostics`
- `provenanceDiagnostics`
- `bestPracticeDiagnostics`
- `AERRecorder`

## Start a new APD scaffold

```js
const fs = require("fs");
const { createApdScaffold } = require("@apd-spec/sdk");

const scaffold = createApdScaffold({
  title: "Refund Review",
  procedureId: "refund-review"
});

fs.writeFileSync("refund-review.apd.json", JSON.stringify(scaffold, null, 2) + "\n");
```

## Builder example

```js
const fs = require("fs");
const { APD, toSopMarkdown } = require("@apd-spec/sdk");

const apd = APD.create({
  procedureId: "hello-world",
  title: "Hello World",
  summary: "Minimal APD created with the SDK.",
  entryConditions: ["A simple example is needed."]
});

apd
  .addAction({
    id: "step_1",
    name: "Do the thing",
    instruction: "Perform the step.",
    recovery: {
      strategy: "ask-user",
      instructions: "Pause for review if the step cannot be completed confidently."
    }
  })
  .addTerminal({
    id: "done",
    name: "Finished",
    outcome: "success"
  })
  .connect("step_1", "done");

fs.writeFileSync("hello-world.apd.json", apd.toString());
console.log(apd.validate());
console.log(toSopMarkdown(apd.toJSON()));
```

## Validate an existing APD

Replace the example filename below with any APD file you have locally:

```js
const fs = require("fs");
const { parseApd, validateApd, summarizeApd } = require("@apd-spec/sdk");

const document = parseApd(fs.readFileSync("refund-review.apd.json", "utf8"));
const result = validateApd(document, { strict: true });

console.log(result.valid);
console.log(result.diagnostics);
console.log(summarizeApd(document));
```

## Export an APD to SOP markdown

Replace the example filename below with any APD file you have locally:

```js
const fs = require("fs");
const { parseApd, toSopMarkdown } = require("@apd-spec/sdk");

const document = parseApd(fs.readFileSync("refund-review.apd.json", "utf8"));
const sop = toSopMarkdown(document);

fs.writeFileSync("/tmp/refund-review.sop.md", sop);
```

`toSopMarkdown` preserves APD provenance markers as HTML comments so the runtime markdown stays readable while still retaining round-trip debugging hints.

## Validate and compare AER

Replace the example filenames below with your local APD and AER paths:

```js
const fs = require("fs");
const { validateAer, compareAerToApd } = require("@apd-spec/sdk");

const apd = fs.readFileSync("refund-review.apd.json", "utf8");
const aer = fs.readFileSync("refund-review.aer-v0.2.json", "utf8");

console.log(validateAer(aer, { strict: true }));
console.log(compareAerToApd(apd, aer));
```

AER v0.1 remains supported for validation and summaries. AER v0.2 is the preferred comparison-capable receipt for APD conformance checks.

## Related docs

- [`../../docs/getting-started.md`](../../docs/getting-started.md)
- [`../../docs/apd-for-agents.md`](../../docs/apd-for-agents.md)
- [`../../docs/apd-to-sop-example.md`](../../docs/apd-to-sop-example.md)
- [`../../adapters/sop-md-mapping.md`](../../adapters/sop-md-mapping.md)
- [`../../spec/apd-v0.1.md`](../../spec/apd-v0.1.md)
- [`../cli/README.md`](../cli/README.md)
