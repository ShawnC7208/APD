const assert = require("assert").strict;
const fs = require("fs");
const os = require("os");
const path = require("path");
const childProcess = require("child_process");

const root = path.resolve(__dirname, "../../..");
const cliBin = path.join(root, "packages/cli/bin/apd.js");
const validateBin = path.join(root, "packages/cli/bin/apd-validate.js");
const invoice = path.join(root, "examples/invoice-logging.apd.json");
const aerV01 = path.join(root, "examples/invoice-logging.aer.json");
const aerV02 = path.join(root, "examples/invoice-logging.aer-v0.2.json");
const aerMismatch = path.join(root, "fixtures/aer/compare/procedure-mismatch.aer-v0.2.json");
const invalid = path.join(root, "fixtures/invalid/missing-kind.apd.json");
const invalidAer = path.join(root, "fixtures/aer/invalid/dangling-evidence.aer-v0.2.json");

function execNode(args) {
  return childProcess.execFileSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8"
  });
}

function execNodeFailure(args) {
  try {
    execNode(args);
  } catch (error) {
    return error;
  }

  throw new Error(`Expected command to fail: ${args.join(" ")}`);
}

function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "apd-cli-test-"));
  const scaffoldPath = path.join(tempDir, "customer.refund.apd.json");
  const initOutput = execNode([cliBin, "init", scaffoldPath]);
  assert.equal(initOutput.includes("Wrote"), true, "init should acknowledge the scaffolded file");
  const scaffoldDocument = JSON.parse(fs.readFileSync(scaffoldPath, "utf8"));
  assert.equal(scaffoldDocument.procedure_id, "customer-refund", "init should derive procedure_id from the output filename");
  assert.equal(scaffoldDocument.title, "Customer Refund", "init should derive a title from the output filename");
  assert.equal(
    scaffoldDocument.summary,
    "TODO: describe the reusable procedure outcome.",
    "init should use the default scaffold summary"
  );
  assert.equal(scaffoldDocument.provenance.producer, "@apd-spec/cli", "init should record the CLI as producer");
  assert.equal(scaffoldDocument.provenance.source_type, "authored", "init should default source_type to authored");
  assert.deepEqual(
    scaffoldDocument.procedure.nodes[0].recovery,
    {
      strategy: "ask-user",
      instructions: "Pause for review if the expected state is missing or the step needs refinement."
    },
    "init should include a starter recovery strategy"
  );

  const initValidateOutput = execNode([cliBin, "validate", scaffoldPath, "--strict"]);
  assert.equal(initValidateOutput.includes("PASS"), true, "init should create a valid scaffold");
  assert.equal(initValidateOutput.includes("WARN"), false, "init scaffold should be strict-clean");

  const initFailure = execNodeFailure([cliBin, "init", scaffoldPath]);
  assert.equal(initFailure.status, 1, "init should refuse to overwrite existing files without --force");
  assert.equal(
    String(initFailure.stderr).includes("Refusing to overwrite existing file"),
    true,
    "init overwrite protection should explain how to use --force"
  );

  const forcedInitOutput = execNode([
    cliBin,
    "init",
    scaffoldPath,
    "--force",
    "--title",
    "Refund Approval Flow",
    "--procedure-id",
    "refund-approval-flow",
    "--summary",
    "Handle refund approvals.",
    "--source-type",
    "observed"
  ]);
  assert.equal(forcedInitOutput.includes("Wrote"), true, "init --force should overwrite an existing file");
  const forcedScaffold = JSON.parse(fs.readFileSync(scaffoldPath, "utf8"));
  assert.equal(forcedScaffold.procedure_id, "refund-approval-flow", "init should honor explicit procedure_id");
  assert.equal(forcedScaffold.title, "Refund Approval Flow", "init should honor explicit title");
  assert.equal(forcedScaffold.summary, "Handle refund approvals.", "init should honor explicit summary");
  assert.equal(forcedScaffold.provenance.source_type, "observed", "init should honor explicit source_type");
  assert.equal(
    forcedScaffold.provenance.source_session_id,
    "TODO: replace-with-observed-source-session-id",
    "observed init should include a placeholder source_session_id"
  );
  assert.deepEqual(
    forcedScaffold.provenance.capture_scope,
    {
      applications: ["TODO: replace-with-observed-application"],
      key_files: ["TODO: replace-with-observed-artifact-or-file"]
    },
    "observed init should include placeholder capture_scope values"
  );

  const forcedInitValidateOutput = execNode([cliBin, "validate", scaffoldPath, "--strict"]);
  assert.equal(forcedInitValidateOutput.includes("PASS"), true, "observed init should remain valid");
  assert.equal(forcedInitValidateOutput.includes("WARN"), false, "observed init scaffold should be strict-clean");

  const validateOutput = execNode([cliBin, "validate", invoice]);
  assert.equal(validateOutput.includes("PASS"), true, "validate should pass the invoice example");
  assert.equal(validateOutput.includes("Log Invoice to Tracker"), true, "validate should print a summary");

  const strictOutput = execNode([cliBin, "validate", invoice, "--strict"]);
  assert.equal(strictOutput.includes("WARN"), false, "strict validate should be clean for the flagship example");

  const infoOutput = execNode([cliBin, "info", invoice]);
  assert.equal(infoOutput.includes("Procedure:"), true, "info should print the procedure id");
  assert.equal(infoOutput.includes("Preview:"), true, "info should print a preview");

  const mermaidOutput = execNode([cliBin, "visualize", invoice, "--format", "mermaid"]);
  assert.equal(mermaidOutput.includes("flowchart TD"), true, "visualize should output Mermaid");

  const svgOutput = execNode([cliBin, "visualize", invoice, "--format", "svg"]);
  assert.equal(svgOutput.includes("<svg"), true, "visualize should output SVG");

  const exportOutput = execNode([cliBin, "export", invoice, "--format", "sop-md"]);
  assert.equal(exportOutput.includes("# Log Invoice to Tracker"), true, "export should print SOP markdown");
  assert.equal(exportOutput.includes("## Steps"), true, "export should include SOP sections");

  const outputPath = path.join(tempDir, "invoice.sop.md");
  const exportFileOutput = execNode([cliBin, "export", invoice, "--format", "sop-md", "--output", outputPath]);
  assert.equal(exportFileOutput.includes("Wrote"), true, "export should acknowledge written file");
  assert.equal(fs.readFileSync(outputPath, "utf8").includes("## Troubleshooting"), true, "exported file should be written");

  const exportFailure = execNodeFailure([cliBin, "export", invalid, "--format", "sop-md"]);
  assert.equal(exportFailure.status, 1, "export should fail when validation fails");
  assert.equal(String(exportFailure.stderr).includes("FAIL"), true, "export failure should print validation details");

  const compatibilityOutput = execNode([validateBin, invoice, "--quiet"]);
  assert.equal(compatibilityOutput, "", "apd-validate compatibility bin should support quiet mode");

  const aerV01ValidateOutput = execNode([cliBin, "aer", "validate", aerV01]);
  assert.equal(aerV01ValidateOutput.includes("PASS"), true, "aer validate should support v0.1 receipts");

  const aerV02ValidateOutput = execNode([cliBin, "aer", "validate", aerV02, "--strict"]);
  assert.equal(aerV02ValidateOutput.includes("PASS"), true, "aer validate should support v0.2 receipts");
  assert.equal(aerV02ValidateOutput.includes("WARN"), false, "strict aer validate should be clean for the v0.2 example");

  const aerInfoOutput = execNode([cliBin, "aer", "info", aerV02]);
  assert.equal(aerInfoOutput.includes("Execution:"), true, "aer info should print execution metadata");
  assert.equal(aerInfoOutput.includes("Final outputs:"), true, "aer info should summarize final outputs");

  const aerCompareOutput = execNode([cliBin, "aer", "compare", invoice, aerV02]);
  assert.equal(aerCompareOutput.includes("PASS"), true, "aer compare should pass for the valid invoice pair");
  assert.equal(aerCompareOutput.includes("differences: 0"), true, "aer compare should print zero differences for the happy path");

  const aerCompareJson = execNode([cliBin, "aer", "compare", invoice, aerV02, "--json"]);
  assert.equal(aerCompareJson.includes('"conforms": true'), true, "aer compare --json should return machine-readable output");

  const aerValidateFailure = execNodeFailure([cliBin, "aer", "validate", invalidAer]);
  assert.equal(aerValidateFailure.status, 1, "aer validate should fail for invalid AER fixtures");
  assert.equal(
    String(aerValidateFailure.stdout).includes("Evidence reference"),
    true,
    "aer validate failure should print semantic validation details"
  );

  const aerCompareFailure = execNodeFailure([cliBin, "aer", "compare", invoice, aerMismatch]);
  assert.equal(aerCompareFailure.status, 1, "aer compare should fail for mismatched receipts");
  assert.equal(
    String(aerCompareFailure.stdout).includes("procedure-ref-mismatch"),
    true,
    "aer compare failure should print the difference kind"
  );

  console.log("All @apd-spec/cli checks passed.");
}

run();
