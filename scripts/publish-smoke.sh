#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK_DIR="$ROOT_DIR/packages/sdk-typescript"
CLI_DIR="$ROOT_DIR/packages/cli"
TMP_DIR="$(mktemp -d)"
CACHE_DIR="${APD_PUBLISH_SMOKE_CACHE:-/tmp/apd-cli-smoke-cache}"
GLOBAL_PREFIX="$TMP_DIR/global-prefix"
export NO_UPDATE_NOTIFIER=1
export npm_config_update_notifier=false
export npm_config_cache="$CACHE_DIR"

cleanup() {
  rm -rf "$TMP_DIR"
  rm -f "$SDK_DIR"/*.tgz "$CLI_DIR"/*.tgz
}

trap cleanup EXIT

cd "$ROOT_DIR"

mkdir -p "$CACHE_DIR"
rm -f "$SDK_DIR"/*.tgz "$CLI_DIR"/*.tgz

echo "Building workspace packages..."
npm run build >/dev/null

echo "Packing SDK..."
(cd "$SDK_DIR" && npm pack >/dev/null)
sdk_path="$(find "$SDK_DIR" -maxdepth 1 -name '*.tgz' -print -quit)"

echo "Packing CLI..."
(cd "$CLI_DIR" && npm pack >/dev/null)
cli_path="$(find "$CLI_DIR" -maxdepth 1 -name '*.tgz' -print -quit)"

echo "Installing tarballs into a clean project..."
mkdir -p "$TMP_DIR/local-install"
cd "$TMP_DIR/local-install"
npm init -y >/dev/null
npm install --cache "$CACHE_DIR" "$sdk_path" >/dev/null
npm install --cache "$CACHE_DIR" "$cli_path" >/dev/null

echo "Checking SDK import..."
node - <<'EOF'
const sdk = require("@apd-spec/sdk");

if (typeof sdk.validateApd !== "function") {
  throw new Error("validateApd export is missing");
}

if (typeof sdk.validateAer !== "function") {
  throw new Error("validateAer export is missing");
}

if (typeof sdk.compareAerToApd !== "function") {
  throw new Error("compareAerToApd export is missing");
}
EOF

echo "Checking locally installed CLI..."
./node_modules/.bin/apd validate "$ROOT_DIR/examples/invoice-logging.apd.json" --quiet
./node_modules/.bin/apd aer compare "$ROOT_DIR/examples/invoice-logging.apd.json" "$ROOT_DIR/examples/invoice-logging.aer-v0.2.json" --json >/dev/null

echo "Checking prefix-installed CLI..."
mkdir -p "$GLOBAL_PREFIX"
npm install -g --prefix "$GLOBAL_PREFIX" --cache "$CACHE_DIR" "$sdk_path" "$cli_path" >/dev/null
"$GLOBAL_PREFIX/bin/apd" validate "$ROOT_DIR/examples/invoice-logging.apd.json" --quiet
"$GLOBAL_PREFIX/bin/apd" aer compare "$ROOT_DIR/examples/invoice-logging.apd.json" "$ROOT_DIR/examples/invoice-logging.aer-v0.2.json" --json >/dev/null

echo "Publish smoke checks passed."
