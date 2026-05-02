# AER Integrity Model

This note defines the byte-level integrity recipe for Agent Execution Record (AER) v0.3. It is written for auditors and implementers who need to verify an AER without trusting the original recorder.

## Goals

AER integrity provides three properties:

- Tamper evidence for the JSON receipt.
- Optional linkage between receipts in a per-execution chain.
- Optional proof that the recorder identity was attested by an Ed25519 key.

It does not provide encryption, storage, or transparency-log submission by itself.

## Canonical JSON

All hashes and attestations use JSON Canonicalization Scheme (JCS), RFC 8785.

Canonical JSON means:

- Object keys are sorted lexicographically.
- No insignificant whitespace is emitted.
- Strings are serialized as JSON strings.
- Numbers follow RFC 8785 section 3.2.2.
- The resulting text is encoded as UTF-8 bytes.

Verifiers MUST canonicalize before hashing or verifying signatures. Pretty-printed JSON and key order in a file are not significant.

The reference SDK implementation follows the RFC 8785 numeric form for the numeric ranges normally produced by AER content, such as counters and durations. Deployments that emit scientific-notation numbers or unusually large numeric values should validate canonicalization against a strict JCS implementation before relying on cross-implementation hashes.

## Chain Hash Recipe

To compute `integrity.chain_hash`:

1. Parse the AER JSON.
2. Clone the parsed document.
3. Set the clone's `integrity` field to `{}`.
4. If the original AER has `integrity.previous_chain_hash`, copy that field into the clone's now-empty `integrity` object.
5. Canonicalize the clone with JCS.
6. Compute SHA-256 over the UTF-8 bytes.
7. Encode as lowercase hex.
8. Prefix with `sha256:`.

The final value is:

```text
sha256:<64 lowercase hex characters>
```

Because mutable integrity artifacts are removed, existing signatures and anchors do not change the hash being checked. `previous_chain_hash` is intentionally retained inside the hashed body so the chain pointer itself is tamper-evident.

## Chaining

`integrity.previous_chain_hash` links one AER to the immediately prior AER in the same execution chain.

The first AER in a chain omits `previous_chain_hash`. Each later AER stores the prior document's `integrity.chain_hash`.

This creates an append-only sequence:

```text
AER 1 chain_hash -> AER 2 previous_chain_hash
AER 2 chain_hash -> AER 3 previous_chain_hash
```

Storage systems should retain the chain head at archive time.

## Signing

`integrity.signature` signs the full chain hash string, not the raw JSON:

```text
ed25519_sign(utf8("sha256:<hex>"))
```

The v0.3 signature object is:

```json
{
  "algorithm": "ed25519",
  "public_key": "<base64-spki-public-key>",
  "value": "<base64-signature>"
}
```

The algorithm is fixed to Ed25519 in v0.3. Older bare-string signatures are accepted by the v0.2 schema for compatibility, but v0.3 verifiers treat them as legacy notes rather than verifiable signatures.

The embedded `public_key` identifies the claimed signing key. It does not establish trust by itself. Auditors should verify signatures with a trusted public key obtained from deployment records, key-management inventory, or another approved trust store.

## Recorder Attestation

`executor.recorder_attestation` proves that the recorder identity was asserted by a signing key.

The signed payload is the canonical JSON of:

```json
{
  "adapter": "<executor.adapter>",
  "agent": "<executor.agent>",
  "environment": "<executor.environment>"
}
```

The attestation object stores:

- `public_key`
- `signature`
- `attested_at`

This separates model output from recorder identity. The adapter or recorder signs the execution metadata; the model does not.

## Transparency Anchors

`integrity.transparency_anchor` can reference an external timestamp or transparency log:

```json
{
  "type": "rekor",
  "reference": "https://rekor.example/entry/...",
  "anchored_at": "2026-04-14T16:04:13Z"
}
```

Supported `type` values in v0.3 are `rfc3161` and `rekor`.

APD tooling records and validates the anchor shape. Submitting to, querying, and trusting an external log remains a deployer responsibility.
