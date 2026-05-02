# Retention Guidance

This note gives practical retention guidance for APD and AER artifacts used in EU AI Act compliance packs. It is not legal advice.

## Regulatory Anchors

Two retention periods are relevant:

- Article 19: technical documentation for high-risk AI systems is commonly retained for 10 years.
- Article 26(6): deployers must keep automatically generated logs for at least 6 months, unless Union or national law provides a different period.

For high-risk deployments, APD and AER artifacts are usually easiest to defend when retained for the longer business and regulatory period that applies to the system.

## What to Retain

Retain:

- Every approved APD revision.
- Every AER produced for regulated executions.
- Public keys used to verify AER signatures.
- Key rotation records.
- Transparency-log receipts or timestamp tokens, when used.
- Conformance reports generated from `apd aer compare`.

Do not rely on mutable dashboards as the only evidence. Dashboards are useful views; APD and AER files are the audit artifacts.

## Storage Pattern

Recommended storage is immutable object storage with retention locks:

- Amazon S3 Object Lock.
- Azure Blob immutability policies.
- Google Cloud Storage Bucket Lock.

Use append-only paths that include system, environment, procedure, revision, and date. Store the signed chain head at archive time.

Example layout:

```text
systems/<system-id>/apd/<procedure-id>/<revision>/procedure.apd.json
systems/<system-id>/aer/<procedure-id>/<revision>/2026/04/14/<execution-id>.aer.json
systems/<system-id>/aer/<procedure-id>/<revision>/2026/04/14/<execution-id>.compare.json
```

## Compression and Format

APD files are small enough for indefinite retention in most environments.

AER files compress well as JSONL or individually compressed JSON because field names repeat across executions. Keep a plain JSON export path available for auditor handoff.

## Archive Verification

At archive time:

1. Validate the APD with `apd validate --strict`.
2. Validate the AER with `apd aer validate --strict`.
3. Verify the AER with `apd aer verify`.
4. Compare the AER to the APD with `apd aer compare`.
5. Store the command outputs with the artifacts.
6. Sign and optionally anchor the latest chain head.

Repeat verification periodically after storage migrations or key rotations.

## Key Retention

Keep public verification keys for at least as long as the AERs they verify.

Private signing keys should be protected by the deployer's normal key-management controls and rotated on a documented schedule. AERs signed before rotation remain verifiable with the old public key.
