#!/usr/bin/env node

const { run } = require("../src/cli");

run(["validate", ...process.argv.slice(2)]).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
