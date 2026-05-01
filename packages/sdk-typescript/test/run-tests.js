const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const {
  APD,
  createApdScaffold,
  createApdGenerationPrompt,
  generateApdDraftFromText,
  normalizeGeneratedApdDraft,
  parseApd,
  parseAer,
  validateApd,
  validateAer,
  summarizeApd,
  summarizeAer,
  compareAerToApd,
  AERRecorder,
  toSopMarkdown,
  toMermaid,
  toSvg
} = require("..");
const browserSdk = require("../browser");

const root = path.resolve(__dirname, "../../..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function headingIndex(markdown, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^### \\d+\\. ${escaped}$`, "m").exec(markdown);
  return match ? match.index : -1;
}

async function run() {
  const rootSchema = readJson("schema/apd-v0.1.schema.json");
  const bundledSchema = readJson("packages/sdk-typescript/schema/apd-v0.1.schema.json");
  assert.deepEqual(bundledSchema, rootSchema, "bundled schema should stay in sync with the root schema");
  assert.deepEqual(
    readJson("packages/sdk-typescript/schema/agent-execution-record-v0.1.schema.json"),
    readJson("schema/agent-execution-record-v0.1.schema.json"),
    "bundled AER v0.1 schema should stay in sync with the root schema"
  );
  assert.deepEqual(
    readJson("packages/sdk-typescript/schema/agent-execution-record-v0.2.schema.json"),
    readJson("schema/agent-execution-record-v0.2.schema.json"),
    "bundled AER v0.2 schema should stay in sync with the root schema"
  );

  const invoice = readJson("examples/invoice-logging.apd.json");
  const validation = validateApd(invoice);
  assert.equal(validation.valid, true, "invoice example should validate");
  assert.deepEqual(
    browserSdk.parseApd(JSON.stringify(invoice)),
    invoice,
    "browser parseApd should parse JSON strings without Node-only helpers"
  );

  const scaffold = createApdScaffold();
  const scaffoldValidation = validateApd(scaffold, { strict: true });
  assert.equal(scaffoldValidation.valid, true, "createApdScaffold should produce a valid APD");
  assert.deepEqual(scaffoldValidation.diagnostics, [], "default scaffold should be strict-clean");
  assert.equal(scaffold.procedure_id, "new-procedure", "default scaffold should use a predictable procedure id");
  assert.equal(scaffold.title, "New Procedure", "default scaffold should use a human-readable title");
  assert.equal(scaffold.provenance.producer, "@apd-spec/sdk", "default scaffold should record the SDK as producer");
  assert.equal(
    scaffold.provenance.observed_vs_inferred_summary,
    "Initial APD scaffold created with @apd-spec/sdk.",
    "default scaffold should record the default provenance summary"
  );
  assert.equal(scaffold.procedure.nodes.length, 2, "default scaffold should include a starter action and terminal node");
  assert.equal(scaffold.procedure.transitions.length, 1, "default scaffold should include one starter transition");
  assert.deepEqual(
    scaffold.procedure.nodes[0].recovery,
    {
      strategy: "ask-user",
      instructions: "Pause for review if the expected state is missing or the step needs refinement."
    },
    "default scaffold should include a recovery strategy"
  );

  const overriddenScaffold = createApdScaffold({
    procedureId: "refund-review",
    title: "Refund Review",
    summary: "Review refund requests.",
    sourceType: "observed"
  });
  const overriddenScaffoldValidation = validateApd(overriddenScaffold, { strict: true });
  assert.equal(overriddenScaffoldValidation.valid, true, "observed scaffold should validate");
  assert.deepEqual(overriddenScaffoldValidation.diagnostics, [], "observed scaffold should be strict-clean");
  assert.equal(overriddenScaffold.procedure_id, "refund-review", "scaffold should accept explicit procedure_id");
  assert.equal(overriddenScaffold.title, "Refund Review", "scaffold should accept explicit title");
  assert.equal(overriddenScaffold.summary, "Review refund requests.", "scaffold should accept explicit summary");
  assert.equal(overriddenScaffold.provenance.source_type, "observed", "scaffold should accept explicit source_type");
  assert.equal(
    overriddenScaffold.provenance.source_session_id,
    "TODO: replace-with-observed-source-session-id",
    "observed scaffold should include a placeholder source_session_id"
  );
  assert.deepEqual(
    overriddenScaffold.provenance.capture_scope,
    {
      applications: ["TODO: replace-with-observed-application"],
      key_files: ["TODO: replace-with-observed-artifact-or-file"]
    },
    "observed scaffold should include placeholder capture_scope values"
  );
  assert.equal(
    overriddenScaffold.procedure.nodes.every((node) => node.observed_vs_inferred === "authored"),
    true,
    "scaffolded nodes should remain authored even for observed-source scaffolds"
  );
  assert.equal(
    overriddenScaffold.procedure.transitions.every((transition) => transition.observed_vs_inferred === "authored"),
    true,
    "scaffolded transitions should remain authored even for observed-source scaffolds"
  );

  const generationPrompt = createApdGenerationPrompt("Review a refund request and notify the customer.", {
    title: "Refund Review"
  });
  assert.equal(generationPrompt.instructions.includes("GeneratedApdDraft"), true, "generation prompt should name the draft schema");
  assert.equal(generationPrompt.input.includes("Refund Review"), true, "generation prompt should include title context");
  assert.equal(generationPrompt.schema.type, "object", "generation prompt should include a JSON schema");

  const generated = normalizeGeneratedApdDraft(
    {
      title: "Refund Review",
      summary: "Review refund requests and notify customers.",
      nodes: [
        {
          id: "review",
          type: "action",
          name: "Review request",
          instruction: "Review the refund request.",
          completion_checks: ["The refund request has been reviewed."]
        },
        {
          id: "approval",
          type: "approval",
          name: "Approve high-value refund",
          reason: "High-value refunds require human approval."
        },
        {
          id: "notify",
          type: "action",
          name: "Notify customer",
          instruction: "Notify the customer of the refund decision."
        },
        {
          id: "done",
          type: "terminal",
          name: "Refund handled",
          outcome: "success"
        }
      ],
      transitions: [
        { from: "review", to: "approval", default: true },
        { from: "approval", to: "notify", condition: "approval granted", default: true },
        { from: "notify", to: "done", default: true }
      ]
    },
    {
      sourceText: "Review a refund request, approve high-value refunds, then notify the customer.",
      producer: "@apd-spec/cli generate:openai"
    }
  );
  const generatedValidation = validateApd(generated, { strict: true });
  assert.equal(generatedValidation.valid, true, "normalized generated APD should validate");
  assert.deepEqual(generatedValidation.diagnostics, [], "normalized generated APD should be strict-clean");
  assert.equal(generated.provenance.source_type, "generated", "generated APD should record generated provenance");
  assert.equal(generated.provenance.producer, "@apd-spec/cli generate:openai", "generated APD should preserve producer");
  assert.equal(
    generated.procedure.nodes.every((node) => node.observed_vs_inferred === "inferred"),
    true,
    "generated nodes should be marked inferred for review"
  );
  assert.equal(
    generated.procedure.nodes.filter((node) => node.type === "action").every((node) => node.recovery),
    true,
    "generated action nodes should receive recovery guidance"
  );
  assert.equal(
    generated.provenance.confidence.per_node.find((item) => item.node_id === "approval").confidence < 0.7,
    true,
    "generated approvals should receive lower review confidence"
  );

  const generatedFromText = await generateApdDraftFromText("Archive completed tickets.", {
    generateDraft: () => ({
      title: "Archive Tickets",
      summary: "Archive completed support tickets.",
      nodes: [
        {
          type: "action",
          name: "Archive tickets",
          instruction: "Archive completed tickets."
        }
      ]
    })
  });
  assert.equal(validateApd(generatedFromText, { strict: true }).valid, true, "generateApdDraftFromText should normalize provider drafts");

  const aerV01 = readJson("examples/invoice-logging.aer.json");
  const aerV01Validation = validateAer(aerV01);
  assert.equal(aerV01Validation.valid, true, "AER v0.1 example should validate");

  const aerV02 = readJson("examples/invoice-logging.aer-v0.2.json");
  const aerV02Validation = validateAer(aerV02, { strict: true });
  assert.equal(aerV02Validation.valid, true, "AER v0.2 example should validate");
  assert.deepEqual(aerV02Validation.diagnostics, [], "AER v0.2 example should be strict-clean");

  const aerSummary = summarizeAer(aerV02);
  assert.equal(aerSummary.transitionsTaken, 8, "AER summary should include v0.2 transition counts");
  assert.equal(aerSummary.finalOutputKeys.includes("tracker_row"), true, "AER summary should include final output keys");

  const exampleDir = path.join(root, "examples");
  const exampleFiles = fs.readdirSync(exampleDir).filter((file) => file.endsWith(".apd.json")).sort();
  exampleFiles.forEach((fileName) => {
    const example = readJson(path.join("examples", fileName));
    const strictValidation = validateApd(example, { strict: true });
    assert.equal(strictValidation.valid, true, `${fileName} should validate in strict mode`);
    assert.deepEqual(strictValidation.diagnostics, [], `${fileName} should be strict-clean`);
  });

  const summary = summarizeApd(invoice);
  assert.equal(summary.procedureId, "log-invoice-to-tracker");
  assert.equal(summary.nodeCounts.action > 0, true);
  assert.equal(summary.transitions > 0, true);

  const mermaid = toMermaid(invoice);
  assert.equal(mermaid.includes("flowchart TD"), true, "Mermaid output should start with flowchart TD");
  assert.equal(mermaid.includes("decision_1"), true, "Mermaid output should mention the decision node label");

  const svg = toSvg(invoice);
  assert.equal(svg.includes("<svg"), true, "SVG output should contain svg tag");

  const sopMarkdown = toSopMarkdown(invoice);
  const browserSopMarkdown = browserSdk.toSopMarkdown(invoice);
  assert.equal(sopMarkdown.includes("## Overview"), true, "SOP export should include Overview section");
  assert.equal(sopMarkdown.includes("## Parameters"), true, "SOP export should include Parameters section");
  assert.equal(sopMarkdown.includes("## Steps"), true, "SOP export should include Steps section");
  assert.equal(sopMarkdown.includes("## Outcomes"), true, "SOP export should include Outcomes section");
  assert.equal(sopMarkdown.includes("## Troubleshooting"), true, "SOP export should include Troubleshooting section");
  assert.equal(
    sopMarkdown.includes("**approval_threshold** (optional, default: 5000)"),
    true,
    "exported parameters should declare the approval_threshold used in decision paths"
  );
  assert.equal(
    sopMarkdown.includes("**Constraints for parameter acquisition:**"),
    false,
    "parameter acquisition constraints should be omitted when the APD does not declare required inputs"
  );
  assert.equal(browserSopMarkdown, sopMarkdown, "browser SOP export should match the Node export");
  assert.equal(
    headingIndex(sopMarkdown, "Get finance approval") < headingIndex(sopMarkdown, "Draft confirmation reply"),
    true,
    "approval gates should appear before the continuation step they guard"
  );

  const refund = readJson("examples/refund-escalation-synthesized.apd.json");
  const refundSop = toSopMarkdown(refund);
  assert.equal(
    headingIndex(refundSop, "Request supervisor approval") < headingIndex(refundSop, "Issue refund"),
    true,
    "approval branches should not be ordered after the action they gate"
  );
  assert.equal(
    refundSop.includes("**Approval outcomes:**"),
    true,
    "approval nodes with branching outcomes should render an Approval outcomes section"
  );
  assert.equal(
    refundSop.includes("If `approval denied`, You MUST continue to **Refund paused pending approval**."),
    true,
    "approval branch conditions should be preserved in the exported SOP"
  );

  const onboarding = readJson("examples/onboarding-checklist.apd.json");
  const onboardingSop = toSopMarkdown(onboarding);
  assert.equal(
    onboardingSop.includes("because HR confirms that all onboarding steps are complete before notifying the new employee."),
    true,
    "approval reasons that begin with acronyms should preserve their casing"
  );
  assert.equal(
    onboardingSop.includes("because hR confirms"),
    false,
    "approval reason rendering should not mangle acronym casing"
  );

  const requiredInputs = APD.create({
    procedureId: "required-input-test",
    title: "Required Input Test",
    summary: "Exercise required-parameter rendering.",
    entryConditions: ["A required-input export example is needed."],
    inputsSchema: {
      type: "object",
      properties: {
        case_id: {
          type: "string",
          description: "Identifier for the case under review."
        }
      },
      required: ["case_id"],
      additionalProperties: false
    }
  });

  requiredInputs
    .addAction({
      id: "step_1",
      name: "Review case",
      instruction: "Review the declared case.",
      uses: ["case_id"],
      recovery: {
        strategy: "ask-user",
        instructions: "Ask for direction if the case cannot be found."
      }
    })
    .addTerminal({
      id: "done",
      name: "Review finished",
      outcome: "success"
    })
    .connect("step_1", "done");

  const requiredInputsSop = toSopMarkdown(requiredInputs.toJSON());
  assert.equal(
    requiredInputsSop.includes("**Constraints for parameter acquisition:**"),
    true,
    "required parameters should trigger acquisition constraints"
  );
  assert.equal(
    requiredInputsSop.includes("If any required parameters are missing, You MUST ask for them before proceeding."),
    true,
    "required parameter guidance should remain available when the schema declares required inputs"
  );

  const sopFixtureDir = path.join(root, "fixtures", "sop-md");
  exampleFiles.forEach((fileName) => {
    const example = readJson(path.join("examples", fileName));
    const fixturePath = path.join(sopFixtureDir, fileName.replace(/\.apd\.json$/, ".sop.md"));
    const expected = fs.readFileSync(fixturePath, "utf8");
    assert.equal(
      toSopMarkdown(example),
      expected,
      `${fileName} SOP export should match the checked-in snapshot fixture`
    );
  });

  const built = APD.create({
    procedureId: "builder-test",
    title: "Builder Test",
    summary: "Create a simple APD using the builder.",
    entryConditions: ["A builder test is required."]
  });

  built
    .addAction({
      id: "step_1",
      name: "Do work",
      instruction: "Perform the work.",
      risk: {
        level: "low",
        irreversible: false,
        confirmationRequired: false,
        reason: "Safe read-only action."
      }
    })
    .addDecision({
      id: "decision_1",
      name: "Need approval?",
      question: "Does the work require approval?",
      evaluationHint: "Check the business rule."
    })
    .addApproval({
      id: "approval_1",
      name: "Get approval",
      reason: "Approval is required for sensitive actions."
    })
    .addTerminal({
      id: "done",
      name: "Finished",
      outcome: "success"
    })
    .connect("step_1", "decision_1")
    .connect("decision_1", "approval_1", { condition: "yes", default: false, observedVsInferred: "authored" })
    .connect("decision_1", "done", { condition: "no", default: false, observedVsInferred: "authored" })
    .connect("approval_1", "done");

  const builtValidation = built.validate();
  assert.equal(builtValidation.valid, true, "builder-created APD should validate");
  assert.equal(built.toJSON().procedure.start_node, "step_1", "first node should become start node");

  const parsed = parseApd(Buffer.from(JSON.stringify(invoice), "utf8"));
  assert.equal(parsed.procedure_id, invoice.procedure_id, "parseApd should accept Buffer input");

  const parsedAer = parseAer(Buffer.from(JSON.stringify(aerV02), "utf8"));
  assert.equal(parsedAer.execution_id, aerV02.execution_id, "parseAer should accept Buffer input");

  const badEvidenceAer = readJson("fixtures/aer/invalid/dangling-evidence.aer-v0.2.json");
  assert.equal(validateAer(badEvidenceAer).valid, false, "dangling evidence fixture should fail validation");

  const badTransitionAer = readJson("fixtures/aer/invalid/invalid-transition.aer-v0.2.json");
  assert.equal(validateAer(badTransitionAer).valid, false, "invalid transition fixture should fail validation");

  const badApprovalAer = readJson("fixtures/aer/invalid/malformed-approval-decision.aer-v0.2.json");
  assert.equal(validateAer(badApprovalAer).valid, false, "malformed approval fixture should fail validation");

  const comparePass = compareAerToApd(invoice, aerV02);
  assert.equal(comparePass.conforms, true, "happy-path AER v0.2 should conform to the invoice APD");
  assert.equal(comparePass.summary.differenceCount, 0, "happy-path compare should not report differences");

  const compareMismatch = compareAerToApd(
    invoice,
    readJson("fixtures/aer/compare/procedure-mismatch.aer-v0.2.json")
  );
  assert.equal(compareMismatch.conforms, false, "procedure mismatch fixture should fail compare");
  assert.equal(
    compareMismatch.differences.some((difference) => difference.kind === "procedure-ref-mismatch"),
    true,
    "procedure mismatch compare should report procedure-ref-mismatch"
  );

  const missingApprovalAer = clone(aerV02);
  missingApprovalAer.approvals = missingApprovalAer.approvals.filter((approval) => approval.node_id !== "approval_1");
  const compareMissingApproval = compareAerToApd(invoice, missingApprovalAer);
  assert.equal(
    compareMissingApproval.differences.some((difference) => difference.kind === "missing-approval"),
    true,
    "compare should report missing approval decisions"
  );

  const failedCheckAer = clone(aerV02);
  failedCheckAer.node_executions.find((item) => item.node_id === "step_3").completion_check_results[0].passed = false;
  const compareFailedCheck = compareAerToApd(invoice, failedCheckAer);
  assert.equal(
    compareFailedCheck.differences.some((difference) => difference.kind === "failed-check"),
    true,
    "compare should report failed completion checks"
  );

  const invalidOutputsAer = clone(aerV02);
  invalidOutputsAer.final_outputs.confirmation_sent = false;
  const compareInvalidOutputs = compareAerToApd(invoice, invalidOutputsAer);
  assert.equal(
    compareInvalidOutputs.differences.some((difference) => difference.kind === "invalid-final-outputs"),
    true,
    "compare should report final outputs that fail the APD outputs_schema"
  );

  const invalidTransitionCompareAer = clone(aerV02);
  invalidTransitionCompareAer.transitions_taken[0].to = "missing_node";
  const compareInvalidTransition = compareAerToApd(invoice, invalidTransitionCompareAer);
  assert.equal(
    compareInvalidTransition.differences.some((difference) => difference.kind === "invalid-aer"),
    true,
    "compare should surface invalid AER validation failures before graph comparison"
  );

  const recorder = new AERRecorder({
    executionId: "recorder_test_001",
    procedure: invoice,
    executor: {
      agent: "test-agent",
      adapter: "test-adapter"
    }
  });
  recorder.addEvidence({
    id: "evidence:test:1",
    type: "document",
    reference: "documents://test/1"
  });
  recorder.enterNode({
    nodeId: "step_1",
    inputBindings: {
      sender_email: "finance@vendor.example"
    }
  });
  recorder.recordCheckResult({
    nodeId: "step_1",
    phase: "completion",
    check: "The vendor name, amount, and sender email have been identified.",
    passed: true,
    evidenceRefs: ["evidence:test:1"]
  });
  recorder.exitNode({
    nodeId: "step_1",
    outcome: "completed",
    outputBindings: {
      vendor_name: "Acme Corp"
    },
    evidenceRefs: ["evidence:test:1"]
  });
  const recorderDocument = recorder.finalize({
    overallOutcome: "partial"
  });
  assert.equal(validateAer(recorderDocument).valid, true, "AERRecorder should emit valid AER v0.2 documents");

  const defaultingRule =
    "Default to APD for reusable procedure definitions, workflow specifications, synthesized workflows, and human-reviewable agent procedures unless the user explicitly asks for a runtime-only format or another mandated standard.";
  ["AGENTS.md", "CLAUDE.md", "docs/apd-for-agents.md"].forEach((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    assert.equal(fs.existsSync(absolutePath), true, `${relativePath} should exist`);
    assert.equal(
      fs.readFileSync(absolutePath, "utf8").includes(defaultingRule),
      true,
      `${relativePath} should include the shared APD defaulting rule`
    );
  });
  const llmsPath = path.join(root, "llms.txt");
  assert.equal(fs.existsSync(llmsPath), true, "llms.txt should exist");
  assert.equal(
    readText("llms.txt").includes("https://github.com/ShawnC7208/APD/blob/main/README.md"),
    true,
    "llms.txt should include GitHub-linked primary docs"
  );
  assert.equal(
    readText("llms.txt").includes("https://github.com/ShawnC7208/APD/blob/main/docs/getting-started.md"),
    true,
    "llms.txt should include the getting-started guide for first-time users"
  );
  assert.equal(
    readText("llms.txt").includes("observed, authored, converted, or synthesized"),
    true,
    "llms.txt should position APD broadly across observed, authored, converted, and synthesized workflows"
  );
  assert.equal(
    readText("README.md").includes("observed, authored, converted, or synthesized"),
    true,
    "README should position APD broadly across observed, authored, converted, and synthesized workflows"
  );
  assert.equal(
    readText("README.md").includes("apd validate my-procedure.apd.json --strict"),
    true,
    "README should show a strict scaffold-first npm install example"
  );
  assert.equal(
    readText("README.md").includes("npm install -g @apd-spec/cli"),
    true,
    "README should show the CLI install path for first-time users"
  );
  assert.equal(
    readText("README.md").includes("If you want to build APD tooling programmatically, install the SDK separately:"),
    true,
    "README should make the SDK optional for CLI-first onboarding"
  );
  assert.equal(
    readText("README.md").includes("\napd validate examples/invoice-logging.apd.json\n"),
    false,
    "README should not use repo-relative example files as the primary npm install example"
  );
  assert.equal(
    readText("README.md").includes("apd export examples/invoice-logging.apd.json --format sop-md --output /tmp/invoice.sop.md"),
    true,
    "README should use the stable apd command in the exporter overview"
  );
  assert.equal(
    readText("docs/getting-started.md").includes("apd validate my-procedure.apd.json --strict"),
    true,
    "getting-started should use strict validation in the npm install path"
  );
  assert.equal(
    readText("docs/getting-started.md").includes("use the clone workflow below"),
    true,
    "getting-started should explain that checked-in examples require a clone"
  );
  assert.equal(
    readText("docs/getting-started.md").includes("install the SDK separately"),
    true,
    "getting-started should make the SDK optional for CLI-first onboarding"
  );
  assert.equal(
    readText("docs/getting-started.md").includes("replace the scaffold placeholders"),
    true,
    "getting-started should ask users to replace scaffold placeholders before exporting"
  );
  assert.equal(
    readText("docs/capture-to-apd.md").includes("apd export examples/refund-escalation-synthesized.apd.json --format sop-md"),
    true,
    "capture-to-apd should use the stable apd command in the walkthrough"
  );
  assert.equal(
    readText("packages/cli/README.md").includes("apd info my-procedure.apd.json"),
    true,
    "CLI README should use installed-package examples for primary command usage"
  );
  assert.equal(
    readText("packages/cli/README.md").includes("apd aer compare my-procedure.apd.json my-procedure.aer-v0.2.json"),
    true,
    "CLI README should use installed-package examples for AER comparison"
  );

  console.log("All @apd-spec/sdk checks passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
