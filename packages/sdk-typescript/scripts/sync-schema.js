const fs = require("fs");
const path = require("path");

const destinationDir = path.resolve(__dirname, "../schema");
const schemaFiles = [
  "apd-v0.1.schema.json",
  "agent-execution-record-v0.1.schema.json",
  "agent-execution-record-v0.2.schema.json"
];

fs.mkdirSync(destinationDir, { recursive: true });

schemaFiles.forEach((fileName) => {
  const sourcePath = path.resolve(__dirname, "../../../schema", fileName);
  const destinationPath = path.join(destinationDir, fileName);
  fs.copyFileSync(sourcePath, destinationPath);
  console.log(`Synced schema to ${destinationPath}`);
});
