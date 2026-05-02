# APD + AER and EU AI Act Article 12

This document maps the [Agent Procedure Definition (APD)](../../spec/apd-v0.1.md) and [Agent Execution Record (AER) v0.3](../../spec/agent-execution-record-aer-v0.3.md) specifications to the record-keeping obligations in [Article 12 of the EU AI Act (Regulation 2024/1689)](https://artificialintelligenceact.eu/article/12/).

It is intended for compliance, legal, and security reviewers evaluating APD+AER for use in high-risk AI systems under Annex III. It is not legal advice.

## Why this matters

Article 12 of the EU AI Act becomes enforceable for Annex III high-risk systems on **2 August 2026**. Failure to meet record-keeping obligations carries administrative fines of up to **€15 million or 3% of global annual turnover**, whichever is higher.

Most agent observability stacks today record traces of model calls. Article 12 does not ask for traces. It asks whether the system did what it was supposed to do, whether someone can prove it, and whether the proof can be inspected by a competent authority years later.

APD+AER answers those questions because the two artifacts are designed to be read together:

```
APD  =  the procedure contract  (what the system was supposed to do)
AER  =  the execution receipt   (what actually happened, signed)
```

A trace tells you the model said something. An APD+AER pair tells you the system followed an approved procedure, which approvals fired, which checks passed, and whether the recorded outcome conforms to the contract — independently of the model that produced it.

## Article 12 obligations and where APD+AER addresses them

| Article 12 obligation | Where APD+AER addresses it | Status |
|---|---|---|
| Art. 12(1) — automatic recording of events over the system lifetime | AER `node_executions[]`, `transitions_taken[]`, `approvals[]`, `tool_invocations[]`, `error`, `recovery_applied`, all timestamped | Covered |
| Art. 12(2)(a) — events relevant to identifying risk situations or substantial modifications | APD `risk` annotations on action nodes; AER `pre_state_check_results`, `completion_check_results`, `error`; APD `revision` + `spec_version` for modification detection | Covered for risk; modification-diff semantics documented in [APD revision semantics](./apd-revision-semantics.md) |
| Art. 12(2)(b) — events facilitating post-market monitoring (Art. 72) | AER conformance comparison against the referenced APD revision (`procedure_ref`) produces machine-checkable post-market evidence; events tagged with `extensions.eu_ai_act.article_12_purpose` | Covered |
| Art. 12(2)(c) — events enabling operational monitoring by deployers (Art. 26(5)) | AER `final_outputs`, `overall_outcome`, `approvals[]`, `error`; deployer-filterable export | Covered |
| Art. 12(3) — biometric identification log content (period of use, reference DB, input data, verifier identity) | Not built in. APD+AER provides the structured carrier (`tool_invocations`, `evidence[]`, `approvals.decided_by`); biometric-specific content lives in adapter implementations | Carrier provided, content out of scope |
| Tamper-evident logging | AER `integrity.chain_hash` (SHA-256 hash chain over canonical JSON) and optional `integrity.signature` (Ed25519 over the chain head). See [AER integrity model](./aer-integrity-model.md) | Covered |
| Independent log generation | AER spec mandates the **adapter is the source of truth, not the model** ([AER v0.3 §Adapter guidance](../../spec/agent-execution-record-aer-v0.3.md)). Recorder identity is attested via `executor.recorder_attestation` (signed adapter identity) | Covered |
| Queryable audit trail | AER is structured JSON keyed by `execution_id` and `procedure_ref.{procedure_id, revision}`. Standard field paths enable SQL/JSONPath/OpenSearch queries without bespoke parsers | Covered |
| Timestamped I/O capture | Every node, transition, approval, tool invocation, and check carries an RFC 3339 timestamp. `input_bindings` and `output_bindings` capture procedure-level I/O | Covered |
| Art. 19 / Art. 26(6) retention (10 years for documentation, minimum 6 months for logs) | APD and AER are static JSON sized for cold archival in append-only object stores. See [retention guidance](./retention-guidance.md) | Covered (guidance) |

## How an Article 12 audit reads APD+AER

A competent authority asking "did this high-risk system operate within its approved bounds during Q3?" needs three things:

1. **The contract.** The APD revision in force during the period under audit. Identified by `procedure_id` + `revision`, immutable once published.
2. **The receipts.** The AER documents produced during that period, each pointing back to its APD via `procedure_ref`. Each AER carries a `chain_hash` linking it into a per-execution hash chain and (optionally) a signature from the adapter's attested key.
3. **The conformance verdict.** Running `apd aer compare <apd> <aer>` produces a structured pass/fail against the APD contract: did execution stay on valid edges, did required approvals occur before proceeding, did checks pass, did final outputs satisfy the schema.

The auditor never asks the model anything. They read the contract, verify the chain on the receipts, and run conformance. That is what "independent log generation" means in practice and it is the property most existing observability stacks cannot offer.

## What APD+AER does not do

- It is not a runtime. APD+AER specifies the contract and the receipt; an adapter executes the procedure.
- It is not a storage system. Retention is the deployer's responsibility; APD+AER specifies the artifacts to retain.
- It is not a substitute for Article 11 technical documentation, Article 13 transparency, Article 14 human oversight, or Article 15 accuracy/robustness obligations. APD's `risk`, `approval` nodes, and `pre_state_checks` contribute to those, but full coverage requires additional system-level documentation.
- It does not cover the biometric-specific content requirements of Art. 12(3). APD+AER is the carrier; biometric matching, reference databases, and verifier identity are recorded by the implementing adapter.

## Verification an auditor can run today

Given an APD file and an AER file produced by a v0.3-conformant recorder:

```sh
# 1. Schema validation
apd validate procedure.apd.json --strict
apd aer validate execution.aer.json --strict

# 2. Integrity verification
apd aer verify execution.aer.json --public-key adapter.pub

# 3. Conformance
apd aer compare procedure.apd.json execution.aer.json --json
```

Each command returns structured output suitable for inclusion in an audit pack alongside the underlying JSON.

## Related documents

- [AER integrity model](./aer-integrity-model.md) — hash-chain construction, signing, optional transparency anchoring
- [APD revision semantics](./apd-revision-semantics.md) — what counts as a substantial modification under Art. 12(2)(a)
- [Retention guidance](./retention-guidance.md) — Art. 19 and Art. 26(6) numbers, archival recommendations
- [APD provenance model](../provenance.md) — how an APD's origin is recorded for review

## References

- [Article 12: Record-Keeping (official text)](https://artificialintelligenceact.eu/article/12/)
- [AI Act Service Desk — Article 12](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-12)
- Article 19 — Automatically generated logs, 10-year retention for documentation
- Article 26(5)–(6) — Deployer obligations, 6-month minimum log retention
- Article 72 — Post-market monitoring
- Article 79(1) — Risk situations triggering corrective action
