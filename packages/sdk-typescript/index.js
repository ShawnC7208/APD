const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

function loadJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadApdSchema() {
  return loadJsonFile(path.resolve(__dirname, "schema", "apd-v0.1.schema.json"));
}

function loadAerSchema(version = "0.2.0") {
  const filenames = {
    "0.1.0": "agent-execution-record-v0.1.schema.json",
    "0.2.0": "agent-execution-record-v0.2.schema.json"
  };

  if (!filenames[version]) {
    throw new Error(`Unsupported AER schema version '${version}'`);
  }

  return loadJsonFile(path.resolve(__dirname, "schema", filenames[version]));
}

function loadSchema() {
  return loadApdSchema();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
}

function parseJsonArtifact(input, artifactName) {
  if (typeof input === "string") {
    return JSON.parse(input);
  }

  if (Buffer.isBuffer(input)) {
    return JSON.parse(input.toString("utf8"));
  }

  ensureObject(input, `${artifactName} input must be a JSON string, Buffer, or object`);
  return clone(input);
}

function parseApd(input) {
  return parseJsonArtifact(input, "APD");
}

function parseAer(input) {
  return parseJsonArtifact(input, "AER");
}

function createAjvValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

function createValidator() {
  return createAjvValidator(loadApdSchema());
}

function createAerValidator(version) {
  return createAjvValidator(loadAerSchema(version));
}

function formatAjvError(error, source = "schema") {
  return {
    kind: "error",
    source,
    path: error.instancePath || "/",
    message: error.message || "Schema validation error"
  };
}

function getNodeMap(document) {
  const map = new Map();
  for (const node of document.procedure?.nodes || []) {
    map.set(node.id, node);
  }
  return map;
}

function graphDiagnostics(document) {
  const diagnostics = [];
  const nodes = document.procedure?.nodes || [];
  const transitions = document.procedure?.transitions || [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map();

  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, []);
  }

  if (!nodeIds.has(document.procedure?.start_node)) {
    diagnostics.push({
      kind: "error",
      source: "graph",
      path: "/procedure/start_node",
      message: `start_node '${document.procedure?.start_node}' does not reference an existing node`
    });
  }

  const terminalCount = nodes.filter((node) => node.type === "terminal").length;
  if (terminalCount === 0) {
    diagnostics.push({
      kind: "error",
      source: "graph",
      path: "/procedure/nodes",
      message: "Procedure must contain at least one terminal node"
    });
  }

  const defaultTransitionSeen = new Map();

  transitions.forEach((transition, index) => {
    if (!nodeIds.has(transition.from)) {
      diagnostics.push({
        kind: "error",
        source: "graph",
        path: `/procedure/transitions/${index}/from`,
        message: `Transition source '${transition.from}' does not reference an existing node`
      });
    }

    if (!nodeIds.has(transition.to)) {
      diagnostics.push({
        kind: "error",
        source: "graph",
        path: `/procedure/transitions/${index}/to`,
        message: `Transition destination '${transition.to}' does not reference an existing node`
      });
    }

    if (nodeIds.has(transition.from) && nodeIds.has(transition.to)) {
      adjacency.get(transition.from).push(transition.to);
    }

    if (transition.default === true) {
      if (defaultTransitionSeen.has(transition.from)) {
        diagnostics.push({
          kind: "error",
          source: "graph",
          path: `/procedure/transitions/${index}`,
          message: `Node '${transition.from}' has more than one transition with default: true. At most one default transition is allowed per source node.`
        });
      } else {
        defaultTransitionSeen.set(transition.from, index);
      }
    }
  });

  if (nodeIds.has(document.procedure?.start_node)) {
    const visited = new Set();
    const stack = [document.procedure.start_node];

    while (stack.length > 0) {
      const current = stack.pop();
      if (visited.has(current)) {
        continue;
      }

      visited.add(current);
      const next = adjacency.get(current) || [];
      for (const nodeId of next) {
        if (!visited.has(nodeId)) {
          stack.push(nodeId);
        }
      }
    }

    nodes.forEach((node, index) => {
      if (!visited.has(node.id)) {
        diagnostics.push({
          kind: "warning",
          source: "graph",
          path: `/procedure/nodes/${index}`,
          message: `Node '${node.id}' is unreachable from start_node`
        });
      }
    });

    // Cycle detection: DFS with a recursion stack to find back-edges.
    const cycleVisited = new Set();
    const inStack = new Set();
    const cycleNodes = new Set();

    function dfsDetectCycle(nodeId) {
      cycleVisited.add(nodeId);
      inStack.add(nodeId);

      for (const neighbor of (adjacency.get(nodeId) || [])) {
        if (!cycleVisited.has(neighbor)) {
          dfsDetectCycle(neighbor);
        } else if (inStack.has(neighbor)) {
          cycleNodes.add(neighbor);
        }
      }

      inStack.delete(nodeId);
    }

    for (const nodeId of nodeIds) {
      if (!cycleVisited.has(nodeId)) {
        dfsDetectCycle(nodeId);
      }
    }

    for (const nodeId of cycleNodes) {
      const index = nodes.findIndex((n) => n.id === nodeId);
      diagnostics.push({
        kind: "error",
        source: "graph",
        path: `/procedure/nodes/${index}`,
        message: `Graph contains a cycle at node '${nodeId}'. APD graphs must be acyclic.`
      });
    }
  }

  return diagnostics;
}

function provenanceDiagnostics(document) {
  const diagnostics = [];
  const provenance = document.provenance || {};

  if (provenance.source_type === "observed") {
    if (!provenance.source_session_id) {
      diagnostics.push({
        kind: "warning",
        source: "provenance",
        path: "/provenance/source_session_id",
        message: "Observed APDs should include source_session_id when a concrete observation session exists"
      });
    }

    if (!provenance.capture_scope) {
      diagnostics.push({
        kind: "warning",
        source: "provenance",
        path: "/provenance/capture_scope",
        message: "Observed APDs should include capture_scope when the observed environment is known"
      });
    }
  }

  return diagnostics;
}

function bestPracticeDiagnostics(document) {
  const diagnostics = [];
  const transitions = document.procedure?.transitions || [];

  (document.procedure?.nodes || []).forEach((node, index) => {
    if (node.type === "action" && !node.recovery) {
      diagnostics.push({
        kind: "warning",
        source: "best-practice",
        path: `/procedure/nodes/${index}/recovery`,
        message: `Action node '${node.id}' has no recovery strategy`
      });
    }

    if (node.type === "decision") {
      const inferredTransitions = transitions.filter(
        (transition) => transition.from === node.id && transition.observed_vs_inferred === "inferred"
      );

      if (inferredTransitions.length > 0 && !node.evaluation_hint) {
        diagnostics.push({
          kind: "warning",
          source: "best-practice",
          path: `/procedure/nodes/${index}/evaluation_hint`,
          message: `Decision node '${node.id}' has inferred transitions but no evaluation_hint`
        });
      }
    }
  });

  return diagnostics;
}

function validateApd(input, options = {}) {
  const document = parseApd(input);
  const validate = createValidator();
  const schemaValid = validate(document);
  const diagnostics = [];

  if (!schemaValid) {
    diagnostics.push(...validate.errors.map(formatAjvError));
  } else {
    diagnostics.push(...graphDiagnostics(document));
    diagnostics.push(...provenanceDiagnostics(document));

    if (options.strict) {
      diagnostics.push(...bestPracticeDiagnostics(document));
    }
  }

  const hasErrors = diagnostics.some((item) => item.kind === "error");

  return {
    valid: !hasErrors,
    diagnostics,
    document
  };
}

function countNodesByType(document) {
  const counts = {
    action: 0,
    decision: 0,
    approval: 0,
    terminal: 0
  };

  for (const node of document.procedure?.nodes || []) {
    if (counts[node.type] !== undefined) {
      counts[node.type] += 1;
    }
  }

  return counts;
}

function renderPathPreview(document, nodeId, visited = new Set()) {
  if (!nodeId || visited.has(nodeId)) {
    return nodeId || "unknown";
  }

  const outgoing = (document.procedure?.transitions || []).filter((transition) => transition.from === nodeId);
  const nextVisited = new Set(visited);
  nextVisited.add(nodeId);

  if (outgoing.length === 0) {
    return nodeId;
  }

  if (outgoing.length === 1) {
    return `${nodeId} -> ${renderPathPreview(document, outgoing[0].to, nextVisited)}`;
  }

  const branches = outgoing.map((transition) => renderPathPreview(document, transition.to, nextVisited));
  return `${nodeId} -> [${branches.join(" | ")}]`;
}

function summarizeApd(input) {
  const document = parseApd(input);
  const nodeCounts = countNodesByType(document);

  return {
    procedureId: document.procedure_id,
    title: document.title,
    revision: document.revision,
    specVersion: document.spec_version,
    startNode: document.procedure?.start_node,
    nodeCounts,
    nodeTotal: Object.values(nodeCounts).reduce((total, count) => total + count, 0),
    transitions: (document.procedure?.transitions || []).length,
    confidence: document.provenance?.confidence?.overall ?? null,
    terminalOutcomes: (document.procedure?.nodes || [])
      .filter((node) => node.type === "terminal")
      .map((node) => node.outcome),
    pathPreview: renderPathPreview(document, document.procedure?.start_node)
  };
}

function mermaidNodeShape(label, type) {
  if (type === "decision") {
    return `{"${label}"}`;
  }

  if (type === "approval") {
    return `[/\"${label}\"/]`;
  }

  if (type === "terminal") {
    return `((" ${label} "))`;
  }

  return `["${label}"]`;
}

function escapeMermaidLabel(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function toMermaid(input) {
  const document = parseApd(input);
  const nodes = document.procedure?.nodes || [];
  const transitions = document.procedure?.transitions || [];
  const ids = new Map();
  const lines = ["flowchart TD"];

  nodes.forEach((node, index) => {
    const mermaidId = `node_${index + 1}`;
    ids.set(node.id, mermaidId);
    const label = escapeMermaidLabel(`${node.id}: ${node.name}`);
    lines.push(`  ${mermaidId}${mermaidNodeShape(label, node.type)}`);
  });

  transitions.forEach((transition) => {
    const fromId = ids.get(transition.from);
    const toId = ids.get(transition.to);
    if (!fromId || !toId) {
      return;
    }

    const condition = transition.condition ? `|${escapeMermaidLabel(transition.condition)}|` : "";
    lines.push(`  ${fromId} -->${condition} ${toId}`);
  });

  return lines.join("\n");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function computeLayout(document) {
  const nodes = document.procedure?.nodes || [];
  const transitions = document.procedure?.transitions || [];
  const nodeMap = getNodeMap(document);
  const levels = new Map();
  const outgoing = new Map();

  nodes.forEach((node) => outgoing.set(node.id, []));
  transitions.forEach((transition) => {
    if (outgoing.has(transition.from)) {
      outgoing.get(transition.from).push(transition.to);
    }
  });

  const queue = [];
  if (document.procedure?.start_node && nodeMap.has(document.procedure.start_node)) {
    levels.set(document.procedure.start_node, 0);
    queue.push(document.procedure.start_node);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    const baseLevel = levels.get(current) || 0;
    for (const nextId of outgoing.get(current) || []) {
      const nextLevel = baseLevel + 1;
      if (!levels.has(nextId) || nextLevel > levels.get(nextId)) {
        levels.set(nextId, nextLevel);
        queue.push(nextId);
      }
    }
  }

  let maxLevel = 0;
  nodes.forEach((node) => {
    if (!levels.has(node.id)) {
      maxLevel += 1;
      levels.set(node.id, maxLevel);
    } else if (levels.get(node.id) > maxLevel) {
      maxLevel = levels.get(node.id);
    }
  });

  const grouped = new Map();
  nodes.forEach((node) => {
    const level = levels.get(node.id) || 0;
    if (!grouped.has(level)) {
      grouped.set(level, []);
    }
    grouped.get(level).push(node);
  });

  const positioned = new Map();
  const levelKeys = Array.from(grouped.keys()).sort((a, b) => a - b);

  levelKeys.forEach((level) => {
    const levelNodes = grouped.get(level);
    levelNodes.forEach((node, index) => {
      positioned.set(node.id, {
        x: 80 + level * 260,
        y: 80 + index * 170
      });
    });
  });

  return positioned;
}

function renderNodeSvg(node, point) {
  const x = point.x;
  const y = point.y;
  const width = 190;
  const height = node.type === "decision" ? 100 : 70;
  const fill = node.type === "approval" ? "#fff5f5" : "#ffffff";
  const stroke = node.type === "approval" ? "#c53030" : "#1f2937";
  const badge = escapeXml(node.type.toUpperCase());
  const title = escapeXml(node.name);

  if (node.type === "decision") {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const diamond = `${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}`;
    return `
      <polygon points="${diamond}" fill="${fill}" stroke="${stroke}" stroke-width="2" />
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#111827">${title}</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#6b7280">${badge}</text>
    `;
  }

  const rx = node.type === "terminal" ? 18 : 8;
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" ry="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="2" />
    <text x="${x + width / 2}" y="${y + 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#111827">${title}</text>
    <text x="${x + width / 2}" y="${y + 48}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#6b7280">${badge}</text>
  `;
}

function renderTransitionSvg(fromPoint, toPoint, condition) {
  const startX = fromPoint.x + 190;
  const startY = fromPoint.y + 35;
  const endX = toPoint.x;
  const endY = toPoint.y + 35;
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2 - 6;
  const label = condition ? `<text x="${midX}" y="${midY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#374151">${escapeXml(condition)}</text>` : "";

  return `
    <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="#4b5563" stroke-width="2" marker-end="url(#arrowhead)" />
    ${label}
  `;
}

function toSvg(input) {
  const document = parseApd(input);
  const nodes = document.procedure?.nodes || [];
  const transitions = document.procedure?.transitions || [];
  const layout = computeLayout(document);
  const nodeMap = getNodeMap(document);
  const width = Math.max(600, ...Array.from(layout.values()).map((point) => point.x + 280));
  const height = Math.max(300, ...Array.from(layout.values()).map((point) => point.y + 160));

  const nodeSvg = nodes.map((node) => renderNodeSvg(node, layout.get(node.id))).join("\n");
  const transitionSvg = transitions
    .filter((transition) => layout.has(transition.from) && layout.has(transition.to))
    .map((transition) =>
      renderTransitionSvg(layout.get(transition.from), layout.get(transition.to), transition.condition)
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(document.title)}">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#4b5563" />
    </marker>
  </defs>
  <rect width="${width}" height="${height}" fill="#f9fafb" />
  ${transitionSvg}
  ${nodeSvg}
</svg>`;
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

  // Preserve leading acronyms like "HR" or "API" when a sentence is embedded mid-clause.
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
    .replace(/^-+|-+$/g, "") || "apd-export";
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

  const lines = [
    `# ${document.title}`,
    ""
  ];

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

function normalizeObservedVsInferred(value) {
  return value || "authored";
}

function normalizeSourceType(value) {
  const sourceType = value || "authored";
  if (!["observed", "authored", "converted", "generated"].includes(sourceType)) {
    throw new Error(`Unsupported source_type '${sourceType}'`);
  }

  return sourceType;
}

function normalizeRisk(risk) {
  if (!risk) {
    return undefined;
  }

  return {
    level: risk.level,
    irreversible: Boolean(risk.irreversible),
    confirmation_required:
      risk.confirmationRequired !== undefined ? Boolean(risk.confirmationRequired) : Boolean(risk.confirmation_required),
    reason: risk.reason
  };
}

function normalizeRecovery(recovery) {
  if (!recovery) {
    return undefined;
  }

  return {
    strategy: recovery.strategy,
    instructions: recovery.instructions
  };
}

function normalizeContextHints(value) {
  return value ? clone(value) : undefined;
}

function normalizeEvidence(value) {
  return value ? clone(value) : undefined;
}

function normalizeCaptureScope(value) {
  if (!value) {
    return undefined;
  }

  return stripUndefined({
    applications: clone(value.applications || []),
    key_files: clone(value.keyFiles || value.key_files || [])
  });
}

function normalizeNodeBase(input) {
  return {
    id: input.id,
    type: input.type,
    name: input.name,
    uses: input.uses,
    produces: input.produces,
    context_hints: normalizeContextHints(input.contextHints || input.context_hints),
    pre_state_checks: input.preStateChecks || input.pre_state_checks,
    completion_checks: input.completionChecks || input.completion_checks,
    recovery: normalizeRecovery(input.recovery),
    risk: normalizeRisk(input.risk),
    evidence: normalizeEvidence(input.evidence),
    observed_vs_inferred: normalizeObservedVsInferred(input.observedVsInferred || input.observed_vs_inferred),
    extensions: input.extensions || {}
  };
}

function stripUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function buildActionNode(input) {
  if (!input.instruction) {
    throw new Error("Action nodes require instruction");
  }

  return stripUndefined({
    ...normalizeNodeBase({ ...input, type: "action" }),
    instruction: input.instruction
  });
}

function buildDecisionNode(input) {
  if (!input.question) {
    throw new Error("Decision nodes require question");
  }

  return stripUndefined({
    ...normalizeNodeBase({ ...input, type: "decision" }),
    question: input.question,
    evaluation_hint: input.evaluationHint || input.evaluation_hint
  });
}

function buildApprovalNode(input) {
  if (!input.reason) {
    throw new Error("Approval nodes require reason");
  }

  return stripUndefined({
    ...normalizeNodeBase({ ...input, type: "approval" }),
    approval_required: true,
    reason: input.reason
  });
}

function buildTerminalNode(input) {
  if (!input.outcome) {
    throw new Error("Terminal nodes require outcome");
  }

  return stripUndefined({
    ...normalizeNodeBase({ ...input, type: "terminal" }),
    outcome: input.outcome
  });
}

function normalizeEntity(entity) {
  return stripUndefined({
    id: entity.id,
    type: entity.type,
    name: entity.name,
    description: entity.description,
    source_hint: entity.sourceHint || entity.source_hint,
    observed_value: entity.observedValue || entity.observed_value
  });
}

function normalizeProvenance(provenance) {
  const base = provenance || {};
  const createdAt = base.createdAt || base.created_at || new Date().toISOString();
  const sourceType = normalizeSourceType(base.sourceType || base.source_type);
  const overallConfidence =
    base.confidence && base.confidence.overall !== undefined ? base.confidence.overall : 1;
  const perNodeConfidence =
    base.confidence && Array.isArray(base.confidence.per_node) ? base.confidence.per_node : [];

  return stripUndefined({
    producer: base.producer || "@apd-spec/sdk",
    source_type: sourceType,
    source_session_id: base.sourceSessionId || base.source_session_id,
    created_at: createdAt,
    capture_scope: normalizeCaptureScope(base.captureScope || base.capture_scope),
    confidence: {
      overall: overallConfidence,
      per_node: clone(perNodeConfidence)
    },
    observed_vs_inferred_summary:
      base.observedVsInferredSummary ||
      base.observed_vs_inferred_summary ||
      "This APD was authored with @apd-spec/sdk."
  });
}

function createApdScaffold(options = {}) {
  const procedureId =
    options.procedureId ||
    options.procedure_id ||
    kebabCase(options.title || "new-procedure");
  const title = options.title || titleCase(procedureId) || "New Procedure";
  const summary = options.summary || "TODO: describe the reusable procedure outcome.";
  const sourceType = normalizeSourceType(options.sourceType || options.source_type);
  const producer = options.producer || "@apd-spec/sdk";
  const sourceSessionId =
    options.sourceSessionId ||
    options.source_session_id ||
    (sourceType === "observed" ? "TODO: replace-with-observed-source-session-id" : undefined);
  const captureScope =
    options.captureScope ||
    options.capture_scope ||
    (sourceType === "observed"
      ? {
          applications: ["TODO: replace-with-observed-application"],
          key_files: ["TODO: replace-with-observed-artifact-or-file"]
        }
      : undefined);
  const observedVsInferredSummary =
    options.observedVsInferredSummary ||
    options.observed_vs_inferred_summary ||
    `Initial APD scaffold created with ${producer}.`;

  const document = APDBuilder.create({
    procedureId,
    revision: options.revision || "1",
    title,
    summary,
    provenance: {
      producer,
      source_type: sourceType,
      source_session_id: sourceSessionId,
      capture_scope: captureScope,
      confidence: {
        overall: 1,
        per_node: []
      },
      observed_vs_inferred_summary: observedVsInferredSummary
    }
  });

  document
    .addAction({
      id: "step_1",
      name: "Perform initial step",
      instruction: "TODO: describe the first reusable step in the procedure.",
      recovery: {
        strategy: "ask-user",
        instructions: "Pause for review if the expected state is missing or the step needs refinement."
      },
      observed_vs_inferred: "authored"
    })
    .addTerminal({
      id: "done",
      name: "Procedure complete",
      outcome: "success",
      observed_vs_inferred: "authored"
    })
    .connect("step_1", "done", {
      default: true,
      observed_vs_inferred: "authored"
    });

  return document.toJSON();
}

class APDBuilder {
  constructor(document) {
    this.document = document;
  }

  static create(options) {
    if (!options || !options.procedureId && !options.procedure_id) {
      throw new Error("APD.create requires procedureId");
    }

    if (!options.title) {
      throw new Error("APD.create requires title");
    }

    if (!options.summary) {
      throw new Error("APD.create requires summary");
    }

    const startNode = options.startNode || options.start_node || "";

    return new APDBuilder({
      kind: "agent-procedure",
      spec_version: "0.1.0",
      procedure_id: options.procedureId || options.procedure_id,
      revision: options.revision || "1",
      title: options.title,
      summary: options.summary,
      entry_conditions: clone(options.entryConditions || options.entry_conditions || []),
      inputs_schema: clone(options.inputsSchema || options.inputs_schema || { type: "object", properties: {} }),
      outputs_schema: clone(options.outputsSchema || options.outputs_schema || { type: "object", properties: {} }),
      entities: clone((options.entities || []).map(normalizeEntity)),
      procedure: {
        start_node: startNode,
        nodes: [],
        transitions: []
      },
      provenance: normalizeProvenance(options.provenance),
      extensions: clone(options.extensions || {})
    });
  }

  static from(input) {
    return new APDBuilder(parseApd(input));
  }

  setStartNode(nodeId) {
    this.assertNodeExists(nodeId);
    this.document.procedure.start_node = nodeId;
    return this;
  }

  assertNodeExists(nodeId) {
    if (!this.document.procedure.nodes.some((node) => node.id === nodeId)) {
      throw new Error(`Node '${nodeId}' does not exist`);
    }
  }

  addNode(node) {
    if (!node.id) {
      throw new Error("Nodes require id");
    }

    if (this.document.procedure.nodes.some((existingNode) => existingNode.id === node.id)) {
      throw new Error(`Node '${node.id}' already exists`);
    }

    this.document.procedure.nodes.push(node);

    if (!this.document.procedure.start_node) {
      this.document.procedure.start_node = node.id;
    }

    return this;
  }

  addAction(input) {
    return this.addNode(buildActionNode(input));
  }

  addDecision(input) {
    return this.addNode(buildDecisionNode(input));
  }

  addApproval(input) {
    return this.addNode(buildApprovalNode(input));
  }

  addTerminal(input) {
    return this.addNode(buildTerminalNode(input));
  }

  connect(from, to, options = {}) {
    this.assertNodeExists(from);
    this.assertNodeExists(to);

    let defaultValue;
    if (options.default !== undefined) {
      defaultValue = Boolean(options.default);
    } else {
      const alreadyHasDefault = this.document.procedure.transitions.some(
        (t) => t.from === from && t.default === true
      );
      defaultValue = !alreadyHasDefault;
    }

    this.document.procedure.transitions.push(
      stripUndefined({
        from,
        to,
        condition: options.condition,
        default: defaultValue,
        observed_vs_inferred: normalizeObservedVsInferred(options.observedVsInferred || options.observed_vs_inferred)
      })
    );

    return this;
  }

  getNode(nodeId) {
    return clone(getNodeMap(this.document).get(nodeId));
  }

  getDefaultTransition(nodeId) {
    const transition = this.document.procedure.transitions.find(
      (item) => item.from === nodeId && item.default === true
    );
    return transition ? clone(transition) : null;
  }

  toJSON() {
    return clone(this.document);
  }

  toString() {
    return JSON.stringify(this.document, null, 2);
  }

  validate(options = {}) {
    return validateApd(this.document, options);
  }
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getAerApprovalTimestamp(approval) {
  return approval.decided_at || approval.approved_at || null;
}

function getAerApprovalDecision(approval) {
  return approval.decision || "approved";
}

function isAerV02(document) {
  return document?.spec_version === "0.2.0";
}

function collectAerEvidenceRefs(document) {
  const refs = [];

  (document.node_executions || []).forEach((execution, index) => {
    (execution.evidence_refs || []).forEach((ref, refIndex) => {
      refs.push({
        path: `/node_executions/${index}/evidence_refs/${refIndex}`,
        ref
      });
    });

    (execution.tool_invocations || []).forEach((invocation, invocationIndex) => {
      (invocation.evidence_refs || []).forEach((ref, refIndex) => {
        refs.push({
          path: `/node_executions/${index}/tool_invocations/${invocationIndex}/evidence_refs/${refIndex}`,
          ref
        });
      });
    });

    ["pre_state_check_results", "completion_check_results"].forEach((field) => {
      (execution[field] || []).forEach((result, resultIndex) => {
        (result.evidence_refs || []).forEach((ref, refIndex) => {
          refs.push({
            path: `/node_executions/${index}/${field}/${resultIndex}/evidence_refs/${refIndex}`,
            ref
          });
        });
      });
    });

    if (execution.error) {
      (execution.error.evidence_refs || []).forEach((ref, refIndex) => {
        refs.push({
          path: `/node_executions/${index}/error/evidence_refs/${refIndex}`,
          ref
        });
      });
    }

    if (execution.recovery_applied) {
      (execution.recovery_applied.evidence_refs || []).forEach((ref, refIndex) => {
        refs.push({
          path: `/node_executions/${index}/recovery_applied/evidence_refs/${refIndex}`,
          ref
        });
      });
    }
  });

  (document.approvals || []).forEach((approval, index) => {
    (approval.evidence_refs || []).forEach((ref, refIndex) => {
      refs.push({
        path: `/approvals/${index}/evidence_refs/${refIndex}`,
        ref
      });
    });
  });

  return refs;
}

function aerTemporalDiagnostics(document) {
  const diagnostics = [];
  const startedAt = parseTimestamp(document.started_at);
  const completedAt = parseTimestamp(document.completed_at);

  if (startedAt !== null && completedAt !== null && completedAt < startedAt) {
    diagnostics.push({
      kind: "error",
      source: "best-practice",
      path: "/completed_at",
      message: "completed_at must not be earlier than started_at"
    });
  }

  if (document.overall_outcome === "success" && !document.completed_at) {
    diagnostics.push({
      kind: "error",
      source: "best-practice",
      path: "/completed_at",
      message: "Successful AERs must include completed_at"
    });
  }

  (document.node_executions || []).forEach((execution, index) => {
    const enteredAt = parseTimestamp(execution.entered_at);
    const exitedAt = parseTimestamp(execution.exited_at);

    if (startedAt !== null && enteredAt !== null && enteredAt < startedAt) {
      diagnostics.push({
        kind: "error",
        source: "best-practice",
        path: `/node_executions/${index}/entered_at`,
        message: "node entered_at must not be earlier than started_at"
      });
    }

    if (enteredAt !== null && exitedAt !== null && exitedAt < enteredAt) {
      diagnostics.push({
        kind: "error",
        source: "best-practice",
        path: `/node_executions/${index}/exited_at`,
        message: "node exited_at must not be earlier than entered_at"
      });
    }

    if (completedAt !== null && exitedAt !== null && exitedAt > completedAt) {
      diagnostics.push({
        kind: "error",
        source: "best-practice",
        path: `/node_executions/${index}/exited_at`,
        message: "node exited_at must not be later than completed_at"
      });
    }

    (execution.tool_invocations || []).forEach((invocation, invocationIndex) => {
      const invocationStartedAt = parseTimestamp(invocation.started_at);
      const invocationCompletedAt = parseTimestamp(invocation.completed_at);

      if (
        invocationStartedAt !== null &&
        invocationCompletedAt !== null &&
        invocationCompletedAt < invocationStartedAt
      ) {
        diagnostics.push({
          kind: "error",
          source: "best-practice",
          path: `/node_executions/${index}/tool_invocations/${invocationIndex}/completed_at`,
          message: "tool invocation completed_at must not be earlier than started_at"
        });
      }
    });
  });

  if (isAerV02(document)) {
    (document.transitions_taken || []).forEach((transition, index) => {
      const takenAt = parseTimestamp(transition.taken_at);
      if (startedAt !== null && takenAt !== null && takenAt < startedAt) {
        diagnostics.push({
          kind: "error",
          source: "best-practice",
          path: `/transitions_taken/${index}/taken_at`,
          message: "transition taken_at must not be earlier than started_at"
        });
      }

      if (completedAt !== null && takenAt !== null && takenAt > completedAt) {
        diagnostics.push({
          kind: "error",
          source: "best-practice",
          path: `/transitions_taken/${index}/taken_at`,
          message: "transition taken_at must not be later than completed_at"
        });
      }
    });
  }

  (document.approvals || []).forEach((approval, index) => {
    const approvalTime = parseTimestamp(getAerApprovalTimestamp(approval));
    if (startedAt !== null && approvalTime !== null && approvalTime < startedAt) {
      diagnostics.push({
        kind: "error",
        source: "best-practice",
        path: `/approvals/${index}`,
        message: "approval timestamp must not be earlier than started_at"
      });
    }

    if (completedAt !== null && approvalTime !== null && approvalTime > completedAt) {
      diagnostics.push({
        kind: "error",
        source: "best-practice",
        path: `/approvals/${index}`,
        message: "approval timestamp must not be later than completed_at"
      });
    }
  });

  return diagnostics;
}

function aerIntegrityDiagnostics(document) {
  const diagnostics = [];
  const evidenceIds = new Set();

  (document.evidence || []).forEach((item, index) => {
    if (evidenceIds.has(item.id)) {
      diagnostics.push({
        kind: "error",
        source: "best-practice",
        path: `/evidence/${index}/id`,
        message: `Duplicate evidence id '${item.id}' is not allowed`
      });
      return;
    }

    evidenceIds.add(item.id);
  });

  collectAerEvidenceRefs(document).forEach((item) => {
    if (!evidenceIds.has(item.ref)) {
      diagnostics.push({
        kind: "error",
        source: "best-practice",
        path: item.path,
        message: `Evidence reference '${item.ref}' does not point at a declared evidence id`
      });
    }
  });

  const attemptsByNode = new Map();
  (document.node_executions || []).forEach((execution, index) => {
    if (!attemptsByNode.has(execution.node_id)) {
      attemptsByNode.set(execution.node_id, []);
    }

    attemptsByNode.get(execution.node_id).push({
      attempt: execution.attempt,
      index
    });
  });

  attemptsByNode.forEach((attempts, nodeId) => {
    const orderedAttempts = attempts
      .map((item) => item.attempt)
      .sort((left, right) => left - right);

    orderedAttempts.forEach((attempt, index) => {
      const expected = index + 1;
      if (attempt !== expected) {
        diagnostics.push({
          kind: "error",
          source: "best-practice",
          path: `/node_executions/${attempts[index].index}/attempt`,
          message: `Execution attempts for node '${nodeId}' must be sequential starting at 1`
        });
      }
    });
  });

  return diagnostics;
}

function aerV02Diagnostics(document) {
  const diagnostics = [];
  const nodeIds = new Set((document.node_executions || []).map((execution) => execution.node_id));
  const approvalByNode = new Map((document.approvals || []).map((approval) => [approval.node_id, approval]));

  (document.transitions_taken || []).forEach((transition, index) => {
    if (!nodeIds.has(transition.from)) {
      diagnostics.push({
        kind: "error",
        source: "best-practice",
        path: `/transitions_taken/${index}/from`,
        message: `Transition source '${transition.from}' does not reference an executed node`
      });
    }

    if (!nodeIds.has(transition.to)) {
      diagnostics.push({
        kind: "error",
        source: "best-practice",
        path: `/transitions_taken/${index}/to`,
        message: `Transition destination '${transition.to}' does not reference an executed node`
      });
    }
  });

  (document.approvals || []).forEach((approval, index) => {
    if (!nodeIds.has(approval.node_id)) {
      diagnostics.push({
        kind: "error",
        source: "best-practice",
        path: `/approvals/${index}/node_id`,
        message: `Approval node '${approval.node_id}' does not reference an executed node`
      });
    }
  });

  (document.node_executions || []).forEach((execution, index) => {
    if (!["approved", "rejected"].includes(execution.outcome)) {
      return;
    }

    const approval = approvalByNode.get(execution.node_id);
    if (!approval) {
      diagnostics.push({
        kind: "error",
        source: "best-practice",
        path: `/node_executions/${index}`,
        message: `Approval node execution '${execution.node_id}' is missing a matching approval decision`
      });
      return;
    }

    const expectedOutcome = approval.decision === "approved" ? "approved" : "rejected";
    if (execution.outcome !== expectedOutcome) {
      diagnostics.push({
        kind: "error",
        source: "best-practice",
        path: `/node_executions/${index}/outcome`,
        message: `Approval node execution '${execution.node_id}' outcome must match approval decision '${approval.decision}'`
      });
    }
  });

  return diagnostics;
}

function aerBestPracticeDiagnostics(document) {
  const diagnostics = [];

  if (isAerV02(document) && document.overall_outcome === "success" && !document.final_outputs) {
    diagnostics.push({
      kind: "warning",
      source: "best-practice",
      path: "/final_outputs",
      message: "Successful AER v0.2 executions should include final_outputs for APD conformance checks"
    });
  }

  if (isAerV02(document) && document.node_executions.length > 1 && document.transitions_taken.length === 0) {
    diagnostics.push({
      kind: "warning",
      source: "best-practice",
      path: "/transitions_taken",
      message: "AER v0.2 executions with multiple node executions should usually record transitions_taken"
    });
  }

  return diagnostics;
}

function validateAer(input, options = {}) {
  const document = parseAer(input);
  const diagnostics = [];
  const supportedVersions = new Set(["0.1.0", "0.2.0"]);

  if (!supportedVersions.has(document.spec_version)) {
    diagnostics.push({
      kind: "error",
      source: "schema",
      path: "/spec_version",
      message: `Unsupported AER spec_version '${document.spec_version}'`
    });

    return {
      valid: false,
      diagnostics,
      document
    };
  }

  const validate = createAerValidator(document.spec_version);
  const schemaValid = validate(document);

  if (!schemaValid) {
    diagnostics.push(...validate.errors.map((error) => formatAjvError(error)));
  } else {
    diagnostics.push(...aerTemporalDiagnostics(document));
    diagnostics.push(...aerIntegrityDiagnostics(document));

    if (isAerV02(document)) {
      diagnostics.push(...aerV02Diagnostics(document));
    }

    if (options.strict) {
      diagnostics.push(...aerBestPracticeDiagnostics(document));
    }
  }

  return {
    valid: !diagnostics.some((item) => item.kind === "error"),
    diagnostics,
    document
  };
}

function summarizeAer(input) {
  const document = parseAer(input);

  return {
    executionId: document.execution_id,
    specVersion: document.spec_version,
    procedureId: document.procedure_ref?.procedure_id || null,
    procedureRevision: document.procedure_ref?.revision || null,
    procedureSpecVersion: document.procedure_ref?.spec_version || null,
    overallOutcome: document.overall_outcome,
    startedAt: document.started_at,
    completedAt: document.completed_at || null,
    nodeExecutions: (document.node_executions || []).length,
    approvals: (document.approvals || []).length,
    evidence: (document.evidence || []).length,
    transitionsTaken: isAerV02(document) ? (document.transitions_taken || []).length : null,
    finalOutputKeys: isAerV02(document) && document.final_outputs ? Object.keys(document.final_outputs) : []
  };
}

function normalizeDifferenceKind(kind) {
  return kind;
}

function makeComparisonDifference(kind, path, message, extra = {}) {
  return {
    kind: normalizeDifferenceKind(kind),
    path,
    message,
    severity: extra.severity || "error",
    expected: extra.expected,
    actual: extra.actual
  };
}

function checkDeclaredResults(expectedChecks, actualResults, path, differenceKind, differences) {
  expectedChecks.forEach((check) => {
    const result = (actualResults || []).find((item) => item.check === check);

    if (!result) {
      differences.push(
        makeComparisonDifference(
          differenceKind,
          path,
          `Required check '${check}' is missing from the execution receipt`,
          { expected: true, actual: "missing" }
        )
      );
      return;
    }

    if (!result.passed) {
      differences.push(
        makeComparisonDifference(
          differenceKind,
          path,
          `Required check '${check}' did not pass`,
          { expected: true, actual: false }
        )
      );
    }
  });
}

function approvalDenialRequiresStop(targetNode) {
  return !targetNode || targetNode.type !== "terminal" || !["canceled", "failure"].includes(targetNode.outcome);
}

function compareAerToApd(apdInput, aerInput) {
  const apdDocument = parseApd(apdInput);
  const aerDocument = parseAer(aerInput);
  const differences = [];
  const apdValidation = validateApd(apdDocument);
  const aerValidation = validateAer(aerDocument);

  if (!apdValidation.valid) {
    apdValidation.diagnostics.forEach((diagnostic) => {
      differences.push(
        makeComparisonDifference("invalid-apd", diagnostic.path, diagnostic.message, {
          severity: diagnostic.kind
        })
      );
    });
  }

  if (!aerValidation.valid) {
    aerValidation.diagnostics.forEach((diagnostic) => {
      differences.push(
        makeComparisonDifference("invalid-aer", diagnostic.path, diagnostic.message, {
          severity: diagnostic.kind
        })
      );
    });
  }

  if (aerDocument.spec_version !== "0.2.0") {
    differences.push(
      makeComparisonDifference(
        "unsupported-aer-version",
        "/spec_version",
        "compareAerToApd only supports AER v0.2.0 receipts",
        {
          expected: "0.2.0",
          actual: aerDocument.spec_version
        }
      )
    );
  }

  if (!apdValidation.valid || aerDocument.spec_version !== "0.2.0") {
    return {
      conforms: false,
      summary: {
        differenceCount: differences.length,
        executedNodeCount: (aerDocument.node_executions || []).length,
        transitionsTaken: (aerDocument.transitions_taken || []).length,
        approvalCount: (aerDocument.approvals || []).length
      },
      differences
    };
  }

  if (aerDocument.procedure_ref?.procedure_id !== apdDocument.procedure_id) {
    differences.push(
      makeComparisonDifference(
        "procedure-ref-mismatch",
        "/procedure_ref/procedure_id",
        "AER procedure_ref.procedure_id does not match the APD procedure_id",
        {
          expected: apdDocument.procedure_id,
          actual: aerDocument.procedure_ref?.procedure_id
        }
      )
    );
  }

  if (aerDocument.procedure_ref?.revision !== apdDocument.revision) {
    differences.push(
      makeComparisonDifference("procedure-ref-mismatch", "/procedure_ref/revision", "AER revision does not match the APD revision", {
        expected: apdDocument.revision,
        actual: aerDocument.procedure_ref?.revision
      })
    );
  }

  if (aerDocument.procedure_ref?.spec_version !== apdDocument.spec_version) {
    differences.push(
      makeComparisonDifference(
        "procedure-ref-mismatch",
        "/procedure_ref/spec_version",
        "AER procedure_ref.spec_version does not match the APD spec_version",
        {
          expected: apdDocument.spec_version,
          actual: aerDocument.procedure_ref?.spec_version
        }
      )
    );
  }

  const apdNodeMap = getNodeMap(apdDocument);
  const apdTransitionSet = new Set(
    (apdDocument.procedure?.transitions || []).map((transition) => `${transition.from}->${transition.to}`)
  );
  const aerApprovalMap = new Map((aerDocument.approvals || []).map((approval) => [approval.node_id, approval]));

  (aerDocument.node_executions || []).forEach((execution, index) => {
    const node = apdNodeMap.get(execution.node_id);
    if (!node) {
      differences.push(
        makeComparisonDifference(
          "unknown-executed-node",
          `/node_executions/${index}/node_id`,
          `Executed node '${execution.node_id}' does not exist in the APD`,
          { actual: execution.node_id }
        )
      );
      return;
    }

    checkDeclaredResults(
      node.pre_state_checks || [],
      execution.pre_state_check_results,
      `/node_executions/${index}/pre_state_check_results`,
      "failed-check",
      differences
    );

    checkDeclaredResults(
      node.completion_checks || [],
      execution.completion_check_results,
      `/node_executions/${index}/completion_check_results`,
      "failed-check",
      differences
    );

    if (node.type === "approval") {
      const approval = aerApprovalMap.get(node.id);
      const outgoingTransitions = (aerDocument.transitions_taken || []).filter((transition) => transition.from === node.id);

      if (!approval) {
        differences.push(
          makeComparisonDifference(
            "missing-approval",
            `/node_executions/${index}`,
            `Approval node '${node.id}' is missing a recorded approval decision`
          )
        );
        return;
      }

      if (approval.decision !== "approved") {
        const invalidContinuation = outgoingTransitions.some((transition) => {
          const targetNode = apdNodeMap.get(transition.to);
          return approvalDenialRequiresStop(targetNode);
        });

        if (invalidContinuation) {
          differences.push(
            makeComparisonDifference(
              "approval-not-granted",
              `/approvals/${node.id}`,
              `Approval node '${node.id}' continued after decision '${approval.decision}'`
            )
          );
        }
      }
    }
  });

  (aerDocument.transitions_taken || []).forEach((transition, index) => {
    if (!apdTransitionSet.has(`${transition.from}->${transition.to}`)) {
      differences.push(
        makeComparisonDifference(
          "invalid-transition",
          `/transitions_taken/${index}`,
          `Transition '${transition.from}' -> '${transition.to}' is not present in the APD graph`
        )
      );
    }
  });

  if (aerDocument.overall_outcome === "success") {
    if (!aerDocument.final_outputs) {
      differences.push(
        makeComparisonDifference(
          "missing-final-outputs",
          "/final_outputs",
          "Successful AER v0.2 executions must include final_outputs to support APD conformance"
        )
      );
    } else {
      const validateOutputs = createAjvValidator(apdDocument.outputs_schema || { type: "object" });
      const outputsValid = validateOutputs(aerDocument.final_outputs);

      if (!outputsValid) {
        const reason = validateOutputs.errors.map((error) => error.message).join("; ");
        differences.push(
          makeComparisonDifference(
            "invalid-final-outputs",
            "/final_outputs",
            `final_outputs do not satisfy the APD outputs_schema${reason ? `: ${reason}` : ""}`
          )
        );
      }
    }
  }

  return {
    conforms: differences.length === 0,
    summary: {
      differenceCount: differences.length,
      executedNodeCount: (aerDocument.node_executions || []).length,
      transitionsTaken: (aerDocument.transitions_taken || []).length,
      approvalCount: (aerDocument.approvals || []).length
    },
    differences
  };
}

class AERRecorder {
  constructor(options = null) {
    this.document = null;

    if (options) {
      this.startExecution(options);
    }
  }

  static deriveProcedureRef(options) {
    if (options.procedure_ref || options.procedureRef) {
      return clone(options.procedure_ref || options.procedureRef);
    }

    const procedure = options.procedure || options.apd;
    if (procedure) {
      return {
        kind: "agent-procedure",
        procedure_id: procedure.procedure_id,
        revision: procedure.revision,
        spec_version: procedure.spec_version
      };
    }

    throw new Error("AERRecorder.startExecution requires procedure_ref or procedure");
  }

  startExecution(options) {
    const procedureRef = AERRecorder.deriveProcedureRef(options);
    const executor = clone(options.executor || {});

    if (!options.executionId && !options.execution_id) {
      throw new Error("AERRecorder.startExecution requires executionId");
    }

    if (!executor.agent || !executor.adapter) {
      throw new Error("AERRecorder.startExecution requires executor.agent and executor.adapter");
    }

    this.document = {
      kind: "agent-execution-record",
      spec_version: "0.2.0",
      execution_id: options.executionId || options.execution_id,
      procedure_ref: procedureRef,
      executor,
      started_at: options.startedAt || options.started_at || new Date().toISOString(),
      overall_outcome: "partial",
      node_executions: [],
      transitions_taken: [],
      approvals: [],
      evidence: [],
      integrity: {
        chain_hash: "sha256:pending"
      },
      extensions: clone(options.extensions || {})
    };

    if (options.finalOutputs || options.final_outputs) {
      this.document.final_outputs = clone(options.finalOutputs || options.final_outputs);
    }

    return this;
  }

  assertStarted() {
    if (!this.document) {
      throw new Error("AERRecorder has not started an execution");
    }
  }

  getNextAttempt(nodeId) {
    return (
      this.document.node_executions.filter((execution) => execution.node_id === nodeId).length + 1
    );
  }

  getExecution(nodeId, attempt = null) {
    const matches = this.document.node_executions.filter((execution) => execution.node_id === nodeId);
    if (matches.length === 0) {
      throw new Error(`No recorded node execution exists for '${nodeId}'`);
    }

    if (attempt === null || attempt === undefined) {
      return matches[matches.length - 1];
    }

    const match = matches.find((execution) => execution.attempt === attempt);
    if (!match) {
      throw new Error(`No recorded node execution exists for '${nodeId}' attempt ${attempt}`);
    }

    return match;
  }

  addEvidence(evidence) {
    this.assertStarted();

    if (this.document.evidence.some((item) => item.id === evidence.id)) {
      throw new Error(`Evidence '${evidence.id}' is already recorded`);
    }

    this.document.evidence.push(
      stripUndefined({
        id: evidence.id,
        type: evidence.type,
        reference: evidence.reference
      })
    );

    return this;
  }

  enterNode(options) {
    this.assertStarted();
    const nodeId = options.nodeId || options.node_id;

    if (!nodeId) {
      throw new Error("enterNode requires nodeId");
    }

    const execution = stripUndefined({
      node_id: nodeId,
      entered_at: options.enteredAt || options.entered_at || new Date().toISOString(),
      outcome: options.outcome || "paused",
      attempt: options.attempt || this.getNextAttempt(nodeId),
      input_bindings: options.inputBindings || options.input_bindings,
      output_bindings: options.outputBindings || options.output_bindings,
      tool_invocations: clone(options.toolInvocations || options.tool_invocations || []),
      evidence_refs: clone(options.evidenceRefs || options.evidence_refs || []),
      pre_state_check_results: clone(options.preStateCheckResults || options.pre_state_check_results || []),
      completion_check_results: clone(options.completionCheckResults || options.completion_check_results || [])
    });

    this.document.node_executions.push(execution);
    return {
      nodeId,
      attempt: execution.attempt
    };
  }

  recordCheckResult(options) {
    this.assertStarted();
    const execution = this.getExecution(options.nodeId || options.node_id, options.attempt);
    const field = options.phase === "pre_state" ? "pre_state_check_results" : "completion_check_results";

    if (!execution[field]) {
      execution[field] = [];
    }

    execution[field].push(
      stripUndefined({
        check: options.check,
        passed: Boolean(options.passed),
        evaluated_at: options.evaluatedAt || options.evaluated_at,
        evidence_refs: clone(options.evidenceRefs || options.evidence_refs || [])
      })
    );

    return this;
  }

  recordToolInvocation(options) {
    this.assertStarted();
    const execution = this.getExecution(options.nodeId || options.node_id, options.attempt);

    if (!execution.tool_invocations) {
      execution.tool_invocations = [];
    }

    execution.tool_invocations.push(
      stripUndefined({
        tool: options.tool,
        started_at: options.startedAt || options.started_at,
        completed_at: options.completedAt || options.completed_at,
        duration_ms: options.durationMs || options.duration_ms,
        outcome: options.outcome,
        evidence_refs: clone(options.evidenceRefs || options.evidence_refs || [])
      })
    );

    return this;
  }

  recordApprovalDecision(options) {
    this.assertStarted();
    this.document.approvals.push(
      stripUndefined({
        node_id: options.nodeId || options.node_id,
        decision: options.decision || "approved",
        decided_by: options.decidedBy || options.decided_by,
        decided_at: options.decidedAt || options.decided_at || new Date().toISOString(),
        comment: options.comment,
        evidence_refs: clone(options.evidenceRefs || options.evidence_refs || [])
      })
    );

    return this;
  }

  recordTransition(options) {
    this.assertStarted();
    this.document.transitions_taken.push(
      stripUndefined({
        from: options.from,
        to: options.to,
        taken_at: options.takenAt || options.taken_at || new Date().toISOString(),
        condition: options.condition
      })
    );

    return this;
  }

  exitNode(options) {
    this.assertStarted();
    const execution = this.getExecution(options.nodeId || options.node_id, options.attempt);

    execution.exited_at = options.exitedAt || options.exited_at || new Date().toISOString();
    execution.outcome = options.outcome || execution.outcome || "completed";

    if (options.outputBindings || options.output_bindings) {
      execution.output_bindings = clone(options.outputBindings || options.output_bindings);
    }

    if (options.inputBindings || options.input_bindings) {
      execution.input_bindings = clone(options.inputBindings || options.input_bindings);
    }

    if (options.evidenceRefs || options.evidence_refs) {
      execution.evidence_refs = clone(options.evidenceRefs || options.evidence_refs);
    }

    if (options.error) {
      execution.error = clone(options.error);
    }

    if (options.recoveryApplied || options.recovery_applied) {
      execution.recovery_applied = clone(options.recoveryApplied || options.recovery_applied);
    }

    return this;
  }

  finalize(options = {}) {
    this.assertStarted();
    this.document.overall_outcome = options.overallOutcome || options.overall_outcome || this.document.overall_outcome;
    this.document.completed_at = options.completedAt || options.completed_at || new Date().toISOString();

    if (options.finalOutputs || options.final_outputs) {
      this.document.final_outputs = clone(options.finalOutputs || options.final_outputs);
    }

    if (options.extensions) {
      this.document.extensions = clone(options.extensions);
    }

    if (options.integrity) {
      this.document.integrity = clone(options.integrity);
    } else {
      const snapshot = clone(this.document);
      snapshot.integrity = undefined;
      const hash = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
      this.document.integrity = {
        chain_hash: `sha256:${hash}`
      };
    }

    return this.toJSON();
  }

  toJSON() {
    this.assertStarted();
    return clone(this.document);
  }

  toString() {
    return JSON.stringify(this.toJSON(), null, 2);
  }
}

module.exports = {
  APD: APDBuilder,
  createApdScaffold,
  parseApd,
  parseAer,
  validateApd,
  validateAer,
  summarizeApd,
  summarizeAer,
  compareAerToApd,
  toSopMarkdown,
  toMermaid,
  toSvg,
  loadSchema,
  loadApdSchema,
  loadAerSchema,
  graphDiagnostics,
  provenanceDiagnostics,
  bestPracticeDiagnostics,
  AERRecorder
};
