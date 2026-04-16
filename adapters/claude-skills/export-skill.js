#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { parseApd, toSopMarkdown } = require("../../packages/sdk-typescript");

function kebabCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "apd-skill";
}

function skillDescription(document) {
  return `${document.summary} Use this skill when the user needs the ${document.title} workflow carried out with the declared parameters and safety gates.`;
}

function yamlScalar(value) {
  return JSON.stringify(String(value || ""));
}

function usage() {
  return "Usage: node adapters/claude-skills/export-skill.js <input.apd.json> <output-dir>";
}

function main() {
  const [, , inputPath, outputDir] = process.argv;
  if (!inputPath || !outputDir) {
    throw new Error(usage());
  }

  const absoluteInput = path.resolve(inputPath);
  const absoluteOutput = path.resolve(outputDir);
  const document = parseApd(fs.readFileSync(absoluteInput, "utf8"));
  const skillName = kebabCase(document.procedure_id);
  const skillDir = path.join(absoluteOutput, skillName);
  const skillPath = path.join(skillDir, "SKILL.md");
  const frontmatter = [
    "---",
    `name: ${yamlScalar(skillName)}`,
    `description: ${yamlScalar(skillDescription(document))}`,
    "---",
    ""
  ].join("\n");

  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(skillPath, `${frontmatter}${toSopMarkdown(document)}`, "utf8");
  console.log(skillPath);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
