function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
}

function parseApd(input) {
  if (typeof input === "string") {
    return JSON.parse(input);
  }

  ensureObject(input, "APD input must be a JSON string or object");
  return clone(input);
}

function getNodeMap(document) {
  const map = new Map();
  for (const node of document.procedure?.nodes || []) {
    map.set(node.id, node);
  }
  return map;
}

function escapeMarkdownInline(value) {
  return String(value || "").replace(/`/g, "\\`");
}

function toSentence(value) {
  if (!value) {
    return "";
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return "";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function sentenceClause(value) {
  const sentence = toSentence(value).replace(/[.!?]$/, "");
  if (!sentence) {
    return "";
  }

  if (/^[A-Z]{2}/.test(sentence)) {
    return sentence;
  }

  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
}

function humanizeIdentifier(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
}

function schemaTypeLabel(schema) {
  if (!schema || typeof schema !== "object") {
    return "value";
  }

  if (Array.isArray(schema.type)) {
    return schema.type.join(" | ");
  }

  if (schema.type) {
    return schema.type;
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return "enum";
  }

  return "value";
}

function formatOptionalText(schema, required) {
  if (required) {
    return "required";
  }

  if (schema && Object.prototype.hasOwnProperty.call(schema, "default")) {
    return `optional, default: ${JSON.stringify(schema.default)}`;
  }

  return "optional";
}

function formatParameterDescription(name, schema) {
  const parts = [];

  if (schema?.description) {
    parts.push(toSentence(schema.description));
  } else {
    parts.push(`Provide the ${humanizeIdentifier(name)} value.`);
  }

  const type = schemaTypeLabel(schema);
  if (type) {
    parts.push(`Type: ${type}.`);
  }

  if (Array.isArray(schema?.enum) && schema.enum.length > 0) {
    parts.push(`Allowed values: ${schema.enum.map((item) => `\`${escapeMarkdownInline(item)}\``).join(", ")}.`);
  }

  if (schema?.format) {
    parts.push(`Format: ${schema.format}.`);
  }

  return parts.join(" ");
}

function getAdjacency(document) {
  const adjacency = new Map();
  (document.procedure?.nodes || []).forEach((node) => adjacency.set(node.id, []));

  (document.procedure?.transitions || []).forEach((transition) => {
    if (adjacency.has(transition.from)) {
      adjacency.get(transition.from).push(transition.to);
    }
  });

  return adjacency;
}

function getReachableNodeIds(document) {
  const adjacency = getAdjacency(document);
  const reachable = new Set();
  const startNode = document.procedure?.start_node;

  if (!startNode || !adjacency.has(startNode)) {
    return reachable;
  }

  const queue = [startNode];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (reachable.has(nodeId)) {
      continue;
    }

    reachable.add(nodeId);
    for (const nextId of adjacency.get(nodeId) || []) {
      if (!reachable.has(nextId)) {
        queue.push(nextId);
      }
    }
  }

  return reachable;
}

function getOrderedNodes(document) {
  const nodes = document.procedure?.nodes || [];
  const nodeMap = getNodeMap(document);
  const transitions = document.procedure?.transitions || [];
  const adjacency = getAdjacency(document);
  const reachable = getReachableNodeIds(document);
  const indexMap = new Map(nodes.map((node, index) => [node.id, index]));
  const indegree = new Map();
  const ordered = [];
  const processed = new Set();

  nodes.forEach((node) => {
    if (reachable.has(node.id)) {
      indegree.set(node.id, 0);
    }
  });

  transitions.forEach((transition) => {
    if (reachable.has(transition.from) && reachable.has(transition.to)) {
      indegree.set(transition.to, (indegree.get(transition.to) || 0) + 1);
    }
  });

  const available = nodes
    .filter((node) => reachable.has(node.id) && (indegree.get(node.id) || 0) === 0)
    .sort((left, right) => indexMap.get(left.id) - indexMap.get(right.id))
    .map((node) => node.id);

  while (available.length > 0) {
    const nodeId = available.shift();
    if (processed.has(nodeId)) {
      continue;
    }

    processed.add(nodeId);
    ordered.push(nodeId);

    for (const nextId of adjacency.get(nodeId) || []) {
      if (!reachable.has(nextId) || processed.has(nextId)) {
        continue;
      }

      indegree.set(nextId, (indegree.get(nextId) || 0) - 1);
      if (indegree.get(nextId) === 0) {
        available.push(nextId);
        available.sort((left, right) => indexMap.get(left) - indexMap.get(right));
      }
    }
  }

  nodes.forEach((node) => {
    if (reachable.has(node.id) && !processed.has(node.id)) {
      ordered.push(node.id);
      processed.add(node.id);
    }
  });

  nodes.forEach((node) => {
    if (!processed.has(node.id)) {
      ordered.push(node.id);
    }
  });

  return ordered.map((nodeId) => nodeMap.get(nodeId)).filter(Boolean);
}

function formatObservedComment(prefix, value, enabled) {
  if (!enabled || !value) {
    return [];
  }

  return [`<!-- ${prefix}: ${value} -->`];
}

function actionKeyword(node) {
  const risk = node.risk || {};
  if (risk.confirmation_required || risk.irreversible || risk.level === "high" || risk.level === "critical") {
    return "MUST";
  }

  return "SHOULD";
}

function formatTransitionTarget(nodeMap, transition) {
  const target = nodeMap.get(transition.to);
  if (!target) {
    return `\`${escapeMarkdownInline(transition.to)}\``;
  }

  return `**${escapeMarkdownInline(target.name)}**`;
}

function buildActionConstraints(node) {
  const constraints = [];
  const primaryKeyword = actionKeyword(node);
  const riskFlags = [];

  if (node.risk?.level) {
    riskFlags.push(`${node.risk.level} risk`);
  }
  if (node.risk?.irreversible) {
    riskFlags.push("irreversible");
  }
  if (node.risk?.confirmation_required) {
    riskFlags.push("requires confirmation");
  }

  let riskSummary = "";
  if (riskFlags.length > 0 && node.risk?.reason) {
    riskSummary = ` because it is ${riskFlags.join(", ")} and ${sentenceClause(node.risk.reason)}`;
  } else if (riskFlags.length > 0) {
    riskSummary = ` because it is ${riskFlags.join(", ")}`;
  } else if (node.risk?.reason) {
    riskSummary = ` because ${sentenceClause(node.risk.reason)}`;
  }

  constraints.push(`You ${primaryKeyword} complete this action before moving on${riskSummary}.`);

  (node.pre_state_checks || []).forEach((check) => {
    constraints.push(`You MUST confirm that ${sentenceClause(check)} before starting this step.`);
  });

  (node.completion_checks || []).forEach((check) => {
    constraints.push(`You MUST verify that ${sentenceClause(check)} before advancing.`);
  });

  if (node.risk?.confirmation_required) {
    constraints.push(`You MUST request explicit confirmation before taking this action because ${sentenceClause(node.risk.reason)}.`);
  }

  if (node.risk?.irreversible) {
    constraints.push(`You MUST NOT proceed without confirmed intent because ${sentenceClause(node.risk.reason)}.`);
  }

  if (node.uses && node.uses.length > 0) {
    constraints.push(
      `You SHOULD use the declared parameters exactly as provided: ${node.uses
        .map((item) => `\`${escapeMarkdownInline(item)}\``)
        .join(", ")}.`
    );
  }

  return constraints;
}

function buildDecisionConstraints(node, outgoing, nodeMap) {
  const constraints = [`You MUST evaluate this question before selecting a path: ${toSentence(node.question)}`];

  if (node.evaluation_hint) {
    constraints.push(`You SHOULD use this evaluation hint: ${toSentence(node.evaluation_hint)}`);
  }

  outgoing.forEach((transition) => {
    if (transition.condition) {
      constraints.push(
        `If \`${escapeMarkdownInline(transition.condition)}\`, You MUST continue to ${formatTransitionTarget(
          nodeMap,
          transition
        )}.`
      );
      return;
    }

    if (transition.default) {
      constraints.push(`If no other condition matches, You MUST continue to ${formatTransitionTarget(nodeMap, transition)}.`);
      return;
    }

    constraints.push(`You MAY continue to ${formatTransitionTarget(nodeMap, transition)} when that branch best fits the situation.`);
  });

  return constraints;
}

function buildApprovalConstraints(node, outgoing, nodeMap) {
  const constraints = [`You MUST stop and request approval before proceeding because ${sentenceClause(node.reason)}.`];

  if (outgoing.length === 1 && !outgoing[0].condition) {
    constraints.push(`After approval is granted, You MUST continue to ${formatTransitionTarget(nodeMap, outgoing[0])}.`);
  } else if (outgoing.length > 0) {
    outgoing.forEach((transition) => {
      if (transition.condition) {
        constraints.push(
          `If \`${escapeMarkdownInline(transition.condition)}\`, You MUST continue to ${formatTransitionTarget(
            nodeMap,
            transition
          )}.`
        );
        return;
      }

      if (transition.default) {
        constraints.push(
          `If no other approval outcome applies, You MUST continue to ${formatTransitionTarget(nodeMap, transition)}.`
        );
        return;
      }

      constraints.push(
        `You MAY continue to ${formatTransitionTarget(nodeMap, transition)} when that approval outcome applies.`
      );
    });
  }

  return constraints;
}

function renderStepBody(node, transitions, nodeMap, options) {
  const lines = [];
  const outgoing = transitions.filter((transition) => transition.from === node.id);

  lines.push(...formatObservedComment(`apd-node ${node.id} observed_vs_inferred`, node.observed_vs_inferred, options.includeMetadataComments));

  if (node.type === "action") {
    lines.push(toSentence(node.instruction));

    if (node.produces && node.produces.length > 0) {
      lines.push(`This step produces ${node.produces.map((item) => `\`${escapeMarkdownInline(item)}\``).join(", ")}.`);
    }

    lines.push("");
    lines.push("**Constraints:**");
    buildActionConstraints(node).forEach((constraint) => lines.push(`- ${constraint}`));
  } else if (node.type === "decision") {
    lines.push(`Evaluate the decision question: ${toSentence(node.question)}`);

    if (outgoing.length > 0) {
      lines.push("");
      lines.push("**Decision paths:**");
      outgoing.forEach((transition) => {
        lines.push(
          `- ${transition.condition ? `If \`${escapeMarkdownInline(transition.condition)}\`` : "If no other condition matches"}, continue to ${formatTransitionTarget(nodeMap, transition)}.`
        );
        lines.push(
          ...formatObservedComment(
            `apd-transition ${transition.from}->${transition.to} observed_vs_inferred`,
            transition.observed_vs_inferred,
            options.includeMetadataComments
          )
        );
      });
    }

    lines.push("");
    lines.push("**Constraints:**");
    buildDecisionConstraints(node, outgoing, nodeMap).forEach((constraint) => lines.push(`- ${constraint}`));
  } else if (node.type === "approval") {
    lines.push(`Stop and request approval for this gate: ${toSentence(node.reason)}`);

    if (outgoing.length > 1 || outgoing.some((transition) => transition.condition)) {
      lines.push("");
      lines.push("**Approval outcomes:**");
      outgoing.forEach((transition) => {
        lines.push(
          `- ${transition.condition ? `If \`${escapeMarkdownInline(transition.condition)}\`` : "If no other approval outcome applies"}, continue to ${formatTransitionTarget(nodeMap, transition)}.`
        );
        lines.push(
          ...formatObservedComment(
            `apd-transition ${transition.from}->${transition.to} observed_vs_inferred`,
            transition.observed_vs_inferred,
            options.includeMetadataComments
          )
        );
      });
    } else {
      outgoing.forEach((transition) => {
        lines.push(
          ...formatObservedComment(
            `apd-transition ${transition.from}->${transition.to} observed_vs_inferred`,
            transition.observed_vs_inferred,
            options.includeMetadataComments
          )
        );
      });
    }

    lines.push("");
    lines.push("**Constraints:**");
    buildApprovalConstraints(node, outgoing, nodeMap).forEach((constraint) => lines.push(`- ${constraint}`));
  }

  return lines;
}

function renderOutcomes(terminals, options) {
  const lines = ["## Outcomes", ""];

  terminals.forEach((node) => {
    lines.push(...formatObservedComment(`apd-node ${node.id} observed_vs_inferred`, node.observed_vs_inferred, options.includeMetadataComments));
    lines.push(`### ${escapeMarkdownInline(node.name)}`);
    lines.push("");
    lines.push(`- Outcome: \`${escapeMarkdownInline(node.outcome)}\``);
    lines.push(`- APD terminal node: \`${escapeMarkdownInline(node.id)}\``);
    lines.push("");
  });

  return lines;
}

function renderExamples(document) {
  const lines = ["## Examples", "", "### Example invocation", ""];
  const properties = document.inputs_schema?.properties || {};
  const propertyNames = Object.keys(properties);

  if (propertyNames.length === 0) {
    lines.push("This workflow does not declare runtime parameters.");
  } else {
    lines.push("```yaml");
    propertyNames.forEach((name) => {
      lines.push(`${name}: <${schemaTypeLabel(properties[name])}>`);
    });
    lines.push("```");
  }

  lines.push("");
  lines.push("### Expected outcomes");
  lines.push("");

  const outputProperties = document.outputs_schema?.properties || {};
  const outputNames = Object.keys(outputProperties);
  if (outputNames.length === 0) {
    lines.push("- Follow the terminal outcome and completion checks defined above.");
  } else {
    outputNames.forEach((name) => {
      lines.push(`- \`${escapeMarkdownInline(name)}\`: ${formatParameterDescription(name, outputProperties[name])}`);
    });
  }

  lines.push("");
  return lines;
}

function renderTroubleshooting(nodes) {
  const lines = ["## Troubleshooting", ""];
  const recoveryNodes = nodes.filter((node) => node.recovery);

  if (recoveryNodes.length === 0) {
    lines.push("### General recovery");
    lines.push("");
    lines.push("If the workflow cannot continue confidently, pause for review before advancing.");
    lines.push("");
    return lines;
  }

  recoveryNodes.forEach((node) => {
    lines.push(`### ${escapeMarkdownInline(node.name)}`);
    lines.push("");
    lines.push(`If this step fails, use the \`${escapeMarkdownInline(node.recovery.strategy)}\` recovery path: ${toSentence(node.recovery.instructions)}`);
    lines.push("");
  });

  return lines;
}

function toSopMarkdown(input, options = {}) {
  const document = parseApd(input);
  const orderedNodes = getOrderedNodes(document);
  const nodeMap = getNodeMap(document);
  const transitions = document.procedure?.transitions || [];
  const stepNodes = orderedNodes.filter((node) => node.type !== "terminal");
  const terminals = orderedNodes.filter((node) => node.type === "terminal");
  const parameters = document.inputs_schema?.properties || {};
  const required = new Set(document.inputs_schema?.required || []);
  const exportOptions = {
    includeMetadataComments: options.includeMetadataComments !== false,
    includeExamples: options.includeExamples !== false,
    includeTroubleshooting: options.includeTroubleshooting !== false
  };

  const lines = [`# ${document.title}`, ""];

  if (exportOptions.includeMetadataComments) {
    lines.push(`<!-- apd-procedure-id: ${document.procedure_id} -->`);
    lines.push(`<!-- apd-revision: ${document.revision} -->`);
    lines.push(`<!-- apd-source-type: ${document.provenance?.source_type || "unknown"} -->`);
    lines.push("");
  }

  lines.push("## Overview");
  lines.push("");
  lines.push(toSentence(document.summary));

  if ((document.entry_conditions || []).length > 0) {
    lines.push("");
    lines.push("Use this SOP when:");
    lines.push("");
    document.entry_conditions.forEach((condition) => lines.push(`- ${toSentence(condition)}`));
  }

  if (document.provenance?.observed_vs_inferred_summary) {
    lines.push("");
    lines.push(`Provenance note: ${toSentence(document.provenance.observed_vs_inferred_summary)}`);
  }

  lines.push("");
  lines.push("## Parameters");
  lines.push("");

  const parameterNames = Object.keys(parameters);
  const requiredParameterNames = parameterNames.filter((name) => required.has(name));
  if (parameterNames.length === 0) {
    lines.push("This SOP has no declared runtime parameters.");
  } else {
    parameterNames.forEach((name) => {
      lines.push(
        `- **${escapeMarkdownInline(name)}** (${formatOptionalText(parameters[name], required.has(name))}): ${formatParameterDescription(
          name,
          parameters[name]
        )}`
      );
    });
  }

  if (requiredParameterNames.length > 0) {
    lines.push("");
    lines.push("**Constraints for parameter acquisition:**");
    lines.push("- If all required parameters are already provided, You MUST proceed to the Steps.");
    lines.push("- If any required parameters are missing, You MUST ask for them before proceeding.");
    lines.push("- When asking for required parameters, You MUST request them in a single prompt.");
    lines.push("- When asking for parameters, You MUST use the exact parameter names as defined.");
  }

  lines.push("");
  lines.push("## Steps");
  lines.push("");

  stepNodes.forEach((node, index) => {
    lines.push(`### ${index + 1}. ${escapeMarkdownInline(node.name)}`);
    lines.push("");
    renderStepBody(node, transitions, nodeMap, exportOptions).forEach((line) => lines.push(line));
    lines.push("");
  });

  renderOutcomes(terminals, exportOptions).forEach((line) => lines.push(line));

  if (exportOptions.includeExamples) {
    renderExamples(document).forEach((line) => lines.push(line));
  }

  if (exportOptions.includeTroubleshooting) {
    renderTroubleshooting(stepNodes).forEach((line) => lines.push(line));
  }

  return lines.join("\n").trimEnd() + "\n";
}

exports.parseApd = parseApd;
exports.toSopMarkdown = toSopMarkdown;
