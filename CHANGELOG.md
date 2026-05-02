# Changelog

All notable changes to APD-Spec will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## v0.3.0

### Added
- Added the AER v0.3 compliance pack with standardized SHA-256 chain hashes, Ed25519 signatures, recorder attestation, and Article 12 purpose tagging.
- Added `apd aer seal` and `apd aer verify` for sealing and verifying AER integrity metadata.
- Added EU AI Act Article 12 compliance docs covering the integrity model, APD revision semantics, and retention guidance.
- Added a signed `examples/invoice-logging.aer-v0.3.json` fixture and documented Ed25519 test keypair.

### Changed
- AER validation, summary, and APD comparison now route v0.3 documents through the v0.3 schema while preserving v0.2 compatibility.
- Migration from AER v0.2 to v0.3 is additive: bump `spec_version` to `0.3.0`, then optionally adopt the new integrity, attestation, and Article 12 extension fields.

## v0.2.0

### Added
- Added `apd generate "describe your workflow"` for provider-backed natural-language APD authoring with OpenAI and Anthropic support.
- Added SDK helpers for APD generation prompts and normalized generated draft handling.
- Added strict validation, repair-attempt handling, mocked CI coverage, and documentation for generated APD scaffolds.

### Changed
- Strands demo adapter (`adapters/strands/demo/run_apd_with_aer.py`): auto-detect `ANTHROPIC_API_KEY` and use `AnthropicModel` when present so the demo runs without AWS credentials; tightened runtime envelope prompt to enforce `tool_invocations.outcome` enum values; added robust `AgentResult` text extraction with markdown fence stripping; added evidence shape guard and outcome normalizer for live model responses.

## v0.1.0

- Repositioned APD as the structured upstream format for machine-synthesized, human-reviewable procedures.
- Added an explicit APD versus markdown SOP framing across launch docs.
- Added `toSopMarkdown` to the TypeScript SDK.
- Added `apd export <file> --format sop-md [--output ...]` to the CLI.
- Added AER v0.2 as the preferred comparison-capable execution receipt format.
- Added SDK support for `parseAer`, `validateAer`, `summarizeAer`, `compareAerToApd`, and `AERRecorder`.
- Added `apd aer validate`, `apd aer info`, and `apd aer compare` to the CLI.
- Added deterministic SOP export fixtures under `fixtures/sop-md/`.
- Added adapter documentation and helper scripts for Strands and Claude Skills, including the APD-aware Strands AER demo path.
- Added `docs/capture-to-apd.md`, `docs/apd-to-sop-example.md`, and `adapters/sop-md-mapping.md`.
- Added a synthesized-from-observation APD example with mixed confidence and inferred branches.
- Kept the minimal AER v0.1 companion spec and added the richer AER v0.2 spec, schema, example, and fixtures.
- Added a repo smoke script and folded it into the test gate.
- Added a package publish smoke script, npm publish metadata, and GitHub Actions CI for the public release path.
