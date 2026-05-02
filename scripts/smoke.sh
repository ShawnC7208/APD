#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run_validate() {
  local file="$1"
  node packages/cli/bin/apd.js validate "$file" --quiet
}

run_validate_strict() {
  local file="$1"
  node packages/cli/bin/apd.js validate "$file" --quiet --strict
}

run_validate_aer() {
  local data_file="$1"
  node packages/cli/bin/apd.js aer validate "$data_file" --quiet
}

run_compare_aer() {
  local procedure_file="$1"
  local execution_file="$2"
  node packages/cli/bin/apd.js aer compare "$procedure_file" "$execution_file" --json >/dev/null
}

echo "Building workspace packages..."
npm run build >/dev/null

echo "Validating examples..."
for file in examples/*.apd.json; do
  run_validate "$file"
done

echo "Validating positive fixtures..."
for file in fixtures/valid/*.apd.json; do
  run_validate "$file"
done

echo "Checking negative fixtures..."
for file in fixtures/invalid/*.apd.json; do
  if run_validate "$file"; then
    echo "Expected validation failure for $file" >&2
    exit 1
  fi
done

echo "Validating AER example..."
run_validate_aer examples/invoice-logging.aer.json
run_validate_aer examples/invoice-logging.aer-v0.2.json
run_validate_aer examples/invoice-logging.aer-v0.3.json
run_compare_aer examples/invoice-logging.apd.json examples/invoice-logging.aer-v0.2.json
run_compare_aer examples/invoice-logging.apd.json examples/invoice-logging.aer-v0.3.json
node packages/cli/bin/apd.js aer verify examples/invoice-logging.aer-v0.3.json --public-key examples/keys/aer-v0.3-test-ed25519-public.spki.b64 >/dev/null

echo "Exercising adapter exporters..."
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "Exercising APD scaffold creation..."
node packages/cli/bin/apd.js init "$tmp_dir/scaffold.apd.json" >/dev/null
run_validate_strict "$tmp_dir/scaffold.apd.json"
node packages/cli/bin/apd.js export "$tmp_dir/scaffold.apd.json" --format sop-md --output "$tmp_dir/scaffold.sop.md" >/dev/null
test -f "$tmp_dir/scaffold.sop.md"
grep -q '^## Steps$' "$tmp_dir/scaffold.sop.md"

echo "Exercising APD natural-language generation..."
APD_GENERATE_MOCK_RESPONSE='{"title":"Refund Review","summary":"Review refund requests, approve high-value refunds, and notify customers.","nodes":[{"id":"review","type":"action","name":"Review request","instruction":"Review the refund request."},{"id":"approval","type":"approval","name":"Approve high-value refund","reason":"High-value refunds require approval."},{"id":"notify","type":"action","name":"Notify customer","instruction":"Notify the customer of the refund decision."},{"id":"done","type":"terminal","name":"Refund handled","outcome":"success"}],"transitions":[{"from":"review","to":"approval","default":true},{"from":"approval","to":"notify","condition":"approval granted","default":true},{"from":"notify","to":"done","default":true}]}' \
  node packages/cli/bin/apd.js generate "Review a refund request, approve high-value refunds, then notify the customer" --provider openai --output "$tmp_dir/generated.apd.json" >/dev/null
run_validate_strict "$tmp_dir/generated.apd.json"

node adapters/strands/export-sop.js examples/invoice-logging.apd.json "$tmp_dir/strands" >/dev/null
test -f "$tmp_dir/strands/log-invoice-to-tracker.sop.md"
grep -q '^## Steps$' "$tmp_dir/strands/log-invoice-to-tracker.sop.md"

node adapters/claude-skills/export-skill.js examples/invoice-logging.apd.json "$tmp_dir/skills" >/dev/null
test -f "$tmp_dir/skills/log-invoice-to-tracker/SKILL.md"
grep -q '^name: "' "$tmp_dir/skills/log-invoice-to-tracker/SKILL.md"
grep -q '^description: "' "$tmp_dir/skills/log-invoice-to-tracker/SKILL.md"

echo "Exercising APD-aware AER demo..."
python3 adapters/strands/demo/run_apd_with_aer.py --apd examples/invoice-logging.apd.json --mock --output "$tmp_dir/invoice-demo.aer-v0.2.json" >/dev/null
run_validate_aer "$tmp_dir/invoice-demo.aer-v0.2.json"

echo "Exercising Microsoft Agent Framework adapter demo..."
python3 adapters/microsoft-agent-framework/demo/run_apd_with_aer.py --apd examples/invoice-logging.apd.json --mock --output "$tmp_dir/invoice-maf-demo.aer-v0.2.json" >/dev/null
run_validate_aer "$tmp_dir/invoice-maf-demo.aer-v0.2.json"
run_compare_aer examples/invoice-logging.apd.json "$tmp_dir/invoice-maf-demo.aer-v0.2.json"

echo "Smoke checks passed."
