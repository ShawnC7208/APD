const fs = require("fs");
const path = require("path");
const {
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
  toSopMarkdown,
  toMermaid,
  toSvg
} = require("@apd-spec/sdk");

function usage() {
  return [
    "Usage:",
    "  apd init <output.apd.json> [--title <title>] [--procedure-id <id>] [--summary <summary>] [--source-type observed|authored|converted|generated] [--force]",
    "  apd generate \"describe your workflow\" [--provider openai|anthropic] [--model <id>] [--output <file.apd.json>] [--title <title>] [--procedure-id <id>] [--force] [--json] [--strict] [--api-key-env <NAME>] [--repair-attempts <n>]",
    "  apd validate <file.apd.json> [--json] [--quiet] [--strict]",
    "  apd info <file.apd.json> [--json]",
    "  apd export <file.apd.json> --format sop-md [--output <file.sop.md>]",
    "  apd visualize <file.apd.json> --format mermaid|svg",
    "  apd aer validate <file.aer.json> [--json] [--quiet] [--strict]",
    "  apd aer info <file.aer.json> [--json]",
    "  apd aer compare <file.apd.json> <file.aer.json> [--json]",
    "",
    "Compatibility:",
    "  apd-validate <file.apd.json> [--json] [--quiet] [--strict]"
  ].join("\n");
}

function readDocument(filePath) {
  const absolutePath = path.resolve(filePath);
  return {
    file: absolutePath,
    document: parseApd(fs.readFileSync(absolutePath, "utf8"))
  };
}

function readAerDocument(filePath) {
  const absolutePath = path.resolve(filePath);
  return {
    file: absolutePath,
    document: parseAer(fs.readFileSync(absolutePath, "utf8"))
  };
}

function formatValidateHuman(filePath, result) {
  const summary = summarizeApd(result.document);
  const lines = [];

  lines.push(`${result.valid ? "PASS" : "FAIL"} ${filePath}`);
  lines.push(
    `${summary.title} (v${summary.revision}, confidence: ${summary.confidence === null ? "n/a" : summary.confidence})`
  );
  lines.push(
    `Nodes: ${summary.nodeTotal} (${summary.nodeCounts.action} action, ${summary.nodeCounts.decision} decision, ${summary.nodeCounts.approval} approval, ${summary.nodeCounts.terminal} terminal)`
  );
  lines.push(`Transitions: ${summary.transitions}`);

  for (const diagnostic of result.diagnostics) {
    const prefix = diagnostic.kind === "warning" ? "WARN" : "ERR";
    lines.push(`${prefix} ${diagnostic.path} ${diagnostic.message}`);
  }

  return lines.join("\n");
}

function formatAerValidateHuman(filePath, result) {
  const summary = summarizeAer(result.document);
  const lines = [];

  lines.push(`${result.valid ? "PASS" : "FAIL"} ${filePath}`);
  lines.push(
    `Execution: ${summary.executionId} (AER v${summary.specVersion}, outcome: ${summary.overallOutcome})`
  );
  lines.push(
    `Procedure: ${summary.procedureId || "unknown"} (revision: ${summary.procedureRevision || "unknown"})`
  );
  lines.push(
    `Nodes: ${summary.nodeExecutions}, approvals: ${summary.approvals}, evidence: ${summary.evidence}, transitions: ${summary.transitionsTaken === null ? "n/a" : summary.transitionsTaken}`
  );

  for (const diagnostic of result.diagnostics) {
    const prefix = diagnostic.kind === "warning" ? "WARN" : "ERR";
    lines.push(`${prefix} ${diagnostic.path} ${diagnostic.message}`);
  }

  return lines.join("\n");
}

function formatInfoHuman(summary) {
  return [
    `${summary.title} (v${summary.revision}, confidence: ${summary.confidence === null ? "n/a" : summary.confidence})`,
    `Procedure: ${summary.procedureId}`,
    `Nodes: ${summary.nodeTotal} (${summary.nodeCounts.action} action, ${summary.nodeCounts.decision} decision, ${summary.nodeCounts.approval} approval, ${summary.nodeCounts.terminal} terminal)`,
    `Transitions: ${summary.transitions}`,
    `Start: ${summary.startNode}`,
    `Preview: ${summary.pathPreview}`
  ].join("\n");
}

function formatAerInfoHuman(summary) {
  return [
    `Execution: ${summary.executionId} (AER v${summary.specVersion}, outcome: ${summary.overallOutcome})`,
    `Procedure: ${summary.procedureId || "unknown"}`,
    `Revision: ${summary.procedureRevision || "unknown"}`,
    `Started: ${summary.startedAt}`,
    `Completed: ${summary.completedAt || "n/a"}`,
    `Nodes: ${summary.nodeExecutions}`,
    `Approvals: ${summary.approvals}`,
    `Evidence: ${summary.evidence}`,
    `Transitions: ${summary.transitionsTaken === null ? "n/a" : summary.transitionsTaken}`,
    `Final outputs: ${summary.finalOutputKeys.length > 0 ? summary.finalOutputKeys.join(", ") : "n/a"}`
  ].join("\n");
}

function formatAerCompareHuman(apdFile, aerFile, result) {
  const lines = [];

  lines.push(`${result.conforms ? "PASS" : "FAIL"} ${aerFile} against ${apdFile}`);
  lines.push(
    `Executed nodes: ${result.summary.executedNodeCount}, transitions: ${result.summary.transitionsTaken}, approvals: ${result.summary.approvalCount}, differences: ${result.summary.differenceCount}`
  );

  result.differences.forEach((difference) => {
    lines.push(`DIFF ${difference.kind} ${difference.path} ${difference.message}`);
  });

  return lines.join("\n");
}

function getFlagValue(args, flagName, defaultValue) {
  const index = args.indexOf(flagName);
  if (index === -1) {
    return defaultValue;
  }

  const next = args[index + 1];
  if (!next || next.startsWith("--")) {
    return defaultValue;
  }

  return next;
}

async function handleValidate(args) {
  const quiet = args.includes("--quiet");
  const json = args.includes("--json");
  const strict = args.includes("--strict");
  const fileArgs = args.filter((arg) => !arg.startsWith("--"));

  if (fileArgs.length !== 1) {
    throw new Error("Usage: apd validate <file.apd.json> [--json] [--quiet] [--strict]");
  }

  const { file, document } = readDocument(fileArgs[0]);
  const result = validateApd(document, { strict });
  const payload = {
    file,
    valid: result.valid,
    diagnostics: result.diagnostics,
    summary: summarizeApd(result.document)
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else if (!quiet) {
    console.log(formatValidateHuman(file, result));
  }

  process.exit(result.valid ? 0 : 1);
}

async function handleInfo(args) {
  const json = args.includes("--json");
  const fileArgs = args.filter((arg) => !arg.startsWith("--"));

  if (fileArgs.length !== 1) {
    throw new Error("Usage: apd info <file.apd.json> [--json]");
  }

  const { document } = readDocument(fileArgs[0]);
  const validation = validateApd(document);
  if (!validation.valid) {
    console.error(formatValidateHuman(path.resolve(fileArgs[0]), validation));
    process.exit(1);
  }

  const summary = summarizeApd(document);
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(formatInfoHuman(summary));
  }
}

async function handleVisualize(args) {
  const format = getFlagValue(args, "--format", "mermaid");
  const fileArgs = args.filter((arg) => !arg.startsWith("--") && !["mermaid", "svg"].includes(arg));

  if (fileArgs.length !== 1) {
    throw new Error("Usage: apd visualize <file.apd.json> --format mermaid|svg");
  }

  const { document } = readDocument(fileArgs[0]);
  const validation = validateApd(document);
  if (!validation.valid) {
    console.error(formatValidateHuman(path.resolve(fileArgs[0]), validation));
    process.exit(1);
  }

  if (format === "svg") {
    console.log(toSvg(document));
    return;
  }

  if (format === "mermaid") {
    console.log(toMermaid(document));
    return;
  }

  throw new Error("Unknown format. Expected --format mermaid|svg");
}

function getFileArgs(args, flagsWithValues = []) {
  const values = new Set(flagsWithValues);
  const fileArgs = [];

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value.startsWith("--")) {
      if (values.has(value)) {
        index += 1;
      }
      continue;
    }

    fileArgs.push(value);
  }

  return fileArgs;
}

function stripApdSuffix(fileName) {
  return String(fileName || "")
    .replace(/\.apd\.json$/i, "")
    .replace(/\.json$/i, "");
}

function humanizeIdentifier(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
}

function titleCase(value) {
  return humanizeIdentifier(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function kebabCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "new-procedure";
}

function getOptionEnvironment(options) {
  return options.env || process.env;
}

function resolveGenerateProvider(args, env) {
  const explicitProvider = getFlagValue(args, "--provider", null);
  const provider = explicitProvider || env.APD_GENERATE_PROVIDER || (env.OPENAI_API_KEY ? "openai" : env.ANTHROPIC_API_KEY ? "anthropic" : null);

  if (!provider) {
    throw new Error("Missing generation provider. Use --provider openai|anthropic or set APD_GENERATE_PROVIDER.");
  }

  if (!["openai", "anthropic"].includes(provider)) {
    throw new Error("Unsupported generation provider. Expected --provider openai|anthropic.");
  }

  return provider;
}

function resolveGenerateApiKey(args, provider, env) {
  const apiKeyEnv = getFlagValue(args, "--api-key-env", null) || (provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY");
  const apiKey = env[apiKeyEnv];

  if (!apiKey && !env.APD_GENERATE_MOCK_RESPONSE) {
    throw new Error(`Missing API key. Set ${apiKeyEnv} or pass --api-key-env <NAME>.`);
  }

  return {
    apiKey,
    apiKeyEnv
  };
}

function parseGenerateDraftResponse(value) {
  if (!value) {
    throw new Error("Provider returned an empty generation response");
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  const text = String(value).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(text);
}

function extractOpenAiResponseText(payload) {
  if (payload.output_text) {
    return payload.output_text;
  }

  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.text) {
        return content.text;
      }
    }
  }

  return null;
}

function extractAnthropicResponseValue(payload) {
  for (const item of payload.content || []) {
    if (item.type === "text" && item.text) {
      return item.text;
    }
    if (item.type === "tool_use" && item.input) {
      return item.input;
    }
  }

  return null;
}

async function postJson(fetchImpl, url, headers, body) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.raw || `HTTP ${response.status}`;
    throw new Error(`Provider request failed: ${message}`);
  }

  return payload;
}

async function callOpenAiGenerate(prompt, options) {
  const payload = await postJson(
    options.fetch,
    "https://api.openai.com/v1/responses",
    {
      authorization: `Bearer ${options.apiKey}`
    },
    {
      model: options.model,
      instructions: prompt.instructions,
      input: prompt.input,
      max_output_tokens: 12000,
      text: {
        format: {
          type: "json_schema",
          name: "generated_apd_draft",
          schema: prompt.schema,
          strict: false
        }
      }
    }
  );

  return parseGenerateDraftResponse(extractOpenAiResponseText(payload));
}

async function callAnthropicGenerate(prompt, options) {
  const payload = await postJson(
    options.fetch,
    "https://api.anthropic.com/v1/messages",
    {
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01"
    },
    {
      model: options.model,
      max_tokens: 12000,
      system: prompt.instructions,
      messages: [
        {
          role: "user",
          content: prompt.input
        }
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: prompt.schema
        }
      }
    }
  );

  return parseGenerateDraftResponse(extractAnthropicResponseValue(payload));
}

function formatDiagnostics(diagnostics) {
  return diagnostics.map((diagnostic) => `${diagnostic.kind.toUpperCase()} ${diagnostic.path} ${diagnostic.message}`).join("\n");
}

function buildRepairPrompt(workflowText, document, diagnostics, baseOptions) {
  const prompt = createApdGenerationPrompt(workflowText, baseOptions);
  return {
    ...prompt,
    input: [
      prompt.input,
      "The previous generated APD failed strict validation after normalization.",
      "Return a corrected GeneratedApdDraft JSON object.",
      "Diagnostics:",
      formatDiagnostics(diagnostics),
      "Previous normalized APD:",
      JSON.stringify(document, null, 2)
    ].join("\n\n")
  };
}

function getGenerateMockDraft(env) {
  if (!env.APD_GENERATE_MOCK_RESPONSE) {
    return null;
  }

  const mock = env.APD_GENERATE_MOCK_RESPONSE;
  if (fs.existsSync(mock)) {
    return JSON.parse(fs.readFileSync(mock, "utf8"));
  }

  return JSON.parse(mock);
}

async function handleGenerate(args, options = {}) {
  const env = getOptionEnvironment(options);
  const output = getFlagValue(args, "--output", null);
  const titleFlag = getFlagValue(args, "--title", null);
  const procedureIdFlag = getFlagValue(args, "--procedure-id", null);
  const json = args.includes("--json");
  const force = args.includes("--force");
  const provider = resolveGenerateProvider(args, env);
  const model = getFlagValue(args, "--model", provider === "openai" ? "gpt-5.1" : "claude-sonnet-4-5");
  const repairAttempts = Number.parseInt(getFlagValue(args, "--repair-attempts", "1"), 10);
  const workflowText = getFileArgs(args, [
    "--provider",
    "--model",
    "--output",
    "--title",
    "--procedure-id",
    "--api-key-env",
    "--repair-attempts"
  ]).join(" ").trim();

  if (!workflowText) {
    throw new Error(
      "Usage: apd generate \"describe your workflow\" [--provider openai|anthropic] [--model <id>] [--output <file.apd.json>]"
    );
  }

  const absoluteOutput = output ? path.resolve(output) : null;
  if (absoluteOutput && fs.existsSync(absoluteOutput) && !force) {
    throw new Error(`Refusing to overwrite existing file '${absoluteOutput}'. Re-run with --force to replace it.`);
  }

  const { apiKey, apiKeyEnv } = resolveGenerateApiKey(args, provider, env);
  const fetchImpl = options.fetch || globalThis.fetch;
  if (!fetchImpl && !env.APD_GENERATE_MOCK_RESPONSE) {
    throw new Error("This Node.js runtime does not provide fetch. Use Node.js 20 or newer.");
  }

  const callProvider = async (prompt) => {
    const mockDraft = getGenerateMockDraft(env);
    if (mockDraft) {
      return mockDraft;
    }

    if (provider === "openai") {
      return callOpenAiGenerate(prompt, { apiKey, model, fetch: fetchImpl });
    }

    return callAnthropicGenerate(prompt, { apiKey, model, fetch: fetchImpl });
  };

  const normalizeOptions = {
    title: titleFlag,
    procedureId: procedureIdFlag,
    sourceText: workflowText,
    producer: `@apd-spec/cli generate:${provider}`
  };
  let document = await generateApdDraftFromText(workflowText, {
    ...normalizeOptions,
    generateDraft: callProvider
  });
  let validation = validateApd(document, { strict: true });
  let attemptsUsed = 0;

  while ((validation.valid === false || validation.diagnostics.length > 0) && attemptsUsed < Math.max(0, repairAttempts)) {
    attemptsUsed += 1;
    const repairPrompt = buildRepairPrompt(workflowText, document, validation.diagnostics, normalizeOptions);
    const repairedDraft = await callProvider(repairPrompt);
    document = normalizeGeneratedApdDraft(repairedDraft, normalizeOptions);
    validation = validateApd(document, { strict: true });
  }

  const payload = {
    provider,
    model,
    api_key_env: apiKeyEnv,
    file: absoluteOutput,
    valid: validation.valid,
    diagnostics: validation.diagnostics,
    summary: summarizeApd(document),
    repair_attempts_used: attemptsUsed,
    document
  };

  if (!validation.valid || validation.diagnostics.length > 0) {
    if (json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.error(formatValidateHuman(absoluteOutput || "<generated>", validation));
    }
    process.exit(1);
  }

  if (absoluteOutput) {
    fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
    fs.writeFileSync(absoluteOutput, JSON.stringify(document, null, 2) + "\n", "utf8");
    if (json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(`Wrote ${absoluteOutput}`);
    }
    return;
  }

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  process.stdout.write(JSON.stringify(document, null, 2) + "\n");
}

async function handleInit(args) {
  const output = getFileArgs(args, ["--title", "--procedure-id", "--summary", "--source-type"]);
  const titleFlag = getFlagValue(args, "--title", null);
  const procedureIdFlag = getFlagValue(args, "--procedure-id", null);
  const summaryFlag = getFlagValue(args, "--summary", null);
  const sourceType = getFlagValue(args, "--source-type", "authored");
  const force = args.includes("--force");

  if (output.length !== 1) {
    throw new Error(
      "Usage: apd init <output.apd.json> [--title <title>] [--procedure-id <id>] [--summary <summary>] [--source-type observed|authored|converted|generated] [--force]"
    );
  }

  const absolutePath = path.resolve(output[0]);
  if (fs.existsSync(absolutePath) && !force) {
    throw new Error(`Refusing to overwrite existing file '${absolutePath}'. Re-run with --force to replace it.`);
  }

  const stem = stripApdSuffix(path.basename(absolutePath));
  const title = titleFlag || titleCase(procedureIdFlag || stem) || "New Procedure";
  const procedureId = procedureIdFlag || kebabCase(titleFlag || stem);
  const summary = summaryFlag || "TODO: describe the reusable procedure outcome.";
  const document = createApdScaffold({
    procedureId,
    title,
    summary,
    sourceType,
    producer: "@apd-spec/cli",
    observedVsInferredSummary: "Initial APD scaffold created with @apd-spec/cli."
  });
  const validation = validateApd(document, { strict: true });
  if (!validation.valid || validation.diagnostics.length > 0) {
    throw new Error(`Generated scaffold failed strict validation for '${absolutePath}'.`);
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, JSON.stringify(document, null, 2) + "\n", "utf8");
  console.log(`Wrote ${absolutePath}`);
}

async function handleExport(args) {
  const format = getFlagValue(args, "--format", "sop-md");
  const output = getFlagValue(args, "--output", null);
  const fileArgs = getFileArgs(args, ["--format", "--output"]);

  if (fileArgs.length !== 1) {
    throw new Error("Usage: apd export <file.apd.json> --format sop-md [--output <file.sop.md>]");
  }

  const { file, document } = readDocument(fileArgs[0]);
  const validation = validateApd(document);
  if (!validation.valid) {
    console.error(formatValidateHuman(file, validation));
    process.exit(1);
  }

  if (format !== "sop-md") {
    throw new Error("Unknown format. Expected --format sop-md");
  }

  const rendered = toSopMarkdown(document);
  if (output) {
    const absolutePath = path.resolve(output);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, rendered, "utf8");
    console.log(`Wrote ${absolutePath}`);
    return;
  }

  process.stdout.write(rendered);
}

async function handleAerValidate(args) {
  const quiet = args.includes("--quiet");
  const json = args.includes("--json");
  const strict = args.includes("--strict");
  const fileArgs = args.filter((arg) => !arg.startsWith("--"));

  if (fileArgs.length !== 1) {
    throw new Error("Usage: apd aer validate <file.aer.json> [--json] [--quiet] [--strict]");
  }

  const { file, document } = readAerDocument(fileArgs[0]);
  const result = validateAer(document, { strict });
  const payload = {
    file,
    valid: result.valid,
    diagnostics: result.diagnostics,
    summary: summarizeAer(result.document)
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else if (!quiet) {
    console.log(formatAerValidateHuman(file, result));
  }

  process.exit(result.valid ? 0 : 1);
}

async function handleAerInfo(args) {
  const json = args.includes("--json");
  const fileArgs = args.filter((arg) => !arg.startsWith("--"));

  if (fileArgs.length !== 1) {
    throw new Error("Usage: apd aer info <file.aer.json> [--json]");
  }

  const { file, document } = readAerDocument(fileArgs[0]);
  const validation = validateAer(document);
  if (!validation.valid) {
    console.error(formatAerValidateHuman(file, validation));
    process.exit(1);
  }

  const summary = summarizeAer(document);
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(formatAerInfoHuman(summary));
  }
}

async function handleAerCompare(args) {
  const json = args.includes("--json");
  const fileArgs = args.filter((arg) => !arg.startsWith("--"));

  if (fileArgs.length !== 2) {
    throw new Error("Usage: apd aer compare <file.apd.json> <file.aer.json> [--json]");
  }

  const apdFile = path.resolve(fileArgs[0]);
  const aerFile = path.resolve(fileArgs[1]);
  const apdDocument = readDocument(apdFile).document;
  const aerDocument = readAerDocument(aerFile).document;
  const result = compareAerToApd(apdDocument, aerDocument);
  const payload = {
    procedure_file: apdFile,
    execution_file: aerFile,
    ...result
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(formatAerCompareHuman(apdFile, aerFile, result));
  }

  process.exit(result.conforms ? 0 : 1);
}

async function handleAer(args) {
  const [command, ...rest] = args;

  if (command === "validate") {
    await handleAerValidate(rest);
    return;
  }

  if (command === "info") {
    await handleAerInfo(rest);
    return;
  }

  if (command === "compare") {
    await handleAerCompare(rest);
    return;
  }

  throw new Error(usage());
}

async function run(args, options = {}) {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(usage());
    return;
  }

  const [command, ...rest] = args;

  if (command === "init") {
    await handleInit(rest, options);
    return;
  }

  if (command === "generate") {
    await handleGenerate(rest, options);
    return;
  }

  if (command === "validate") {
    await handleValidate(rest, options);
    return;
  }

  if (command === "info") {
    await handleInfo(rest, options);
    return;
  }

  if (command === "export") {
    await handleExport(rest, options);
    return;
  }

  if (command === "visualize") {
    await handleVisualize(rest, options);
    return;
  }

  if (command === "aer") {
    await handleAer(rest, options);
    return;
  }

  throw new Error(usage());
}

module.exports = {
  run,
  usage,
  callOpenAiGenerate,
  callAnthropicGenerate
};
