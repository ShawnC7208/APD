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

## Entry points

Use the entry point that matches your environment:

- `@apd-spec/sdk` or `@apd-spec/sdk/node` for Node.js validation, schema loading, CLI helpers, and the full SDK surface
- `@apd-spec/sdk/browser` for browser-safe APD parsing, APD types, and SOP markdown export without filesystem or schema-loading dependencies

Example browser-safe import:

```ts
import type { APDDocument } from "@apd-spec/sdk/browser";
import { toSopMarkdown } from "@apd-spec/sdk/browser";
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
- `createApdGenerationPrompt`
- `generateApdDraftFromText`
- `normalizeGeneratedApdDraft`

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

Node-only integrity helpers from `@apd-spec/sdk/node`:

- `canonicalizeJson`
- `computeAerChainHash`
- `sealAer`
- `verifyAerIntegrity`

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

## Normalize a generated APD draft

Provider calls belong in your application or the CLI, but the SDK can create the prompt contract and normalize a provider draft into APD:

```js
const { createApdGenerationPrompt, normalizeGeneratedApdDraft, validateApd } = require("@apd-spec/sdk");

const prompt = createApdGenerationPrompt("Review a refund request, approve high-value refunds, then notify the customer.");
const draft = await callYourModel(prompt);
const apd = normalizeGeneratedApdDraft(draft, {
  producer: "my-tool generate:openai",
  sourceText: prompt.input
});

console.log(validateApd(apd, { strict: true }));
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
const aer = fs.readFileSync("refund-review.aer-v0.3.json", "utf8");

console.log(validateAer(aer, { strict: true }));
console.log(compareAerToApd(apd, aer));
```

AER v0.1 remains supported for validation and summaries. AER v0.2 remains supported for comparison. AER v0.3 is the preferred signed receipt for compliance-grade integrity checks.

## Seal and verify AER integrity

```js
const fs = require("fs");
const { sealAer, verifyAerIntegrity } = require("@apd-spec/sdk/node");

const aer = JSON.parse(fs.readFileSync("refund-review.aer-v0.3.json", "utf8"));
const privateKey = fs.readFileSync("adapter.pkcs8.b64", "utf8");
const publicKey = fs.readFileSync("adapter.spki.b64", "utf8");

const sealed = sealAer(aer, { privateKey, publicKey, attestExecutor: true });
console.log(verifyAerIntegrity(sealed, { trustedPublicKeys: [publicKey] }));
```

`verifyAerIntegrity` requires trusted public keys supplied by the caller to report signatures and recorder attestations as valid. Embedded AER public keys are treated as claimed signer metadata, not as a trust root.

## Related docs

- [`../../docs/getting-started.md`](../../docs/getting-started.md)
- [`../../docs/apd-for-agents.md`](../../docs/apd-for-agents.md)
- [`../../docs/apd-to-sop-example.md`](../../docs/apd-to-sop-example.md)
- [`../../adapters/sop-md-mapping.md`](../../adapters/sop-md-mapping.md)
- [`../../spec/apd-v0.1.md`](../../spec/apd-v0.1.md)
- [`../cli/README.md`](../cli/README.md)
