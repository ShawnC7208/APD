#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { parseApd, toSopMarkdown } = require("../../packages/sdk-typescript");

function usage() {
  return "Usage: node adapters/strands/export-sop.js <input.apd.json> <output-dir>";
}

function main() {
  const [, , inputPath, outputDir] = process.argv;
  if (!inputPath || !outputDir) {
    throw new Error(usage());
  }

  const absoluteInput = path.resolve(inputPath);
  const absoluteOutput = path.resolve(outputDir);
  const document = parseApd(fs.readFileSync(absoluteInput, "utf8"));
  const fileName = `${document.procedure_id}.sop.md`;
  const targetPath = path.join(absoluteOutput, fileName);

  fs.mkdirSync(absoluteOutput, { recursive: true });
  fs.writeFileSync(targetPath, toSopMarkdown(document), "utf8");
  console.log(targetPath);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
