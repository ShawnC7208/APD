const crypto = require("crypto");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalizeJson(value) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("JCS canonicalization does not support non-finite numbers");
    }
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`);
    return `{${entries.join(",")}}`;
  }

  throw new Error(`JCS canonicalization does not support ${typeof value}`);
}

function computeAerChainHash(aer) {
  const document = clone(aer);
  document.integrity = {};
  if (aer?.integrity?.previous_chain_hash) {
    document.integrity.previous_chain_hash = aer.integrity.previous_chain_hash;
  }
  const digest = crypto.createHash("sha256").update(Buffer.from(canonicalizeJson(document), "utf8")).digest("hex");
  return `sha256:${digest}`;
}

function looksLikePem(value) {
  return typeof value === "string" && value.includes("-----BEGIN ");
}

function isLikelyPath(value) {
  return typeof value === "string" && !looksLikePem(value) && /[./\\]/.test(value) && require("fs").existsSync(value);
}

function readKeyValue(value) {
  if (isLikelyPath(value)) {
    return require("fs").readFileSync(value, "utf8");
  }
  return value;
}

function normalizeBase64(value) {
  return String(value).replace(/\s+/g, "");
}

function importPrivateKey(value) {
  const key = readKeyValue(value);
  if (!key) {
    return null;
  }
  if (key.type === "private") {
    return key;
  }
  if (Buffer.isBuffer(key)) {
    return crypto.createPrivateKey({ key, format: "der", type: "pkcs8" });
  }
  if (looksLikePem(key)) {
    return crypto.createPrivateKey(key);
  }
  return crypto.createPrivateKey({
    key: Buffer.from(normalizeBase64(key), "base64"),
    format: "der",
    type: "pkcs8"
  });
}

function importPublicKey(value) {
  const key = readKeyValue(value);
  if (!key) {
    return null;
  }
  if (key.type === "public") {
    return key;
  }
  if (Buffer.isBuffer(key)) {
    return crypto.createPublicKey({ key, format: "der", type: "spki" });
  }
  if (looksLikePem(key)) {
    return crypto.createPublicKey(key);
  }
  return crypto.createPublicKey({
    key: Buffer.from(normalizeBase64(key), "base64"),
    format: "der",
    type: "spki"
  });
}

function publicKeyToBase64(publicKey) {
  const keyObject = publicKey.type === "public" ? publicKey : crypto.createPublicKey(publicKey);
  return keyObject.export({ format: "der", type: "spki" }).toString("base64");
}

function executorAttestationPayload(executor) {
  return {
    adapter: executor?.adapter,
    agent: executor?.agent,
    environment: executor?.environment
  };
}

function signString(value, privateKey) {
  return crypto.sign(null, Buffer.from(value, "utf8"), privateKey).toString("base64");
}

function verifyString(value, signature, publicKey) {
  return crypto.verify(null, Buffer.from(value, "utf8"), publicKey, Buffer.from(signature, "base64"));
}

function safeVerifyString(value, signature, publicKey) {
  try {
    return verifyString(value, signature, publicKey);
  } catch {
    return false;
  }
}

function sealAer(aer, options = {}) {
  const document = clone(aer);
  const privateKey = importPrivateKey(options.privateKey);
  const publicKey = options.publicKey ? importPublicKey(options.publicKey) : privateKey ? crypto.createPublicKey(privateKey) : null;
  const publicKeyBase64 = publicKey ? publicKeyToBase64(publicKey) : null;

  if (options.attestExecutor && privateKey && publicKeyBase64) {
    if (!document.executor || typeof document.executor !== "object") {
      throw new Error("Cannot attest executor because executor is missing");
    }
    const attestationPayload = canonicalizeJson(executorAttestationPayload(document.executor));
    document.executor.recorder_attestation = {
      public_key: publicKeyBase64,
      signature: signString(attestationPayload, privateKey),
      attested_at: options.attestedAt || options.attested_at || new Date().toISOString()
    };
  }

  document.integrity = {
    chain_hash: "sha256:pending"
  };

  if (options.previousChainHash) {
    document.integrity.previous_chain_hash = options.previousChainHash;
  }

  const chainHash = computeAerChainHash(document);
  document.integrity.chain_hash = chainHash;

  if (privateKey && publicKeyBase64) {
    document.integrity.signature = {
      algorithm: "ed25519",
      public_key: publicKeyBase64,
      value: signString(chainHash, privateKey)
    };
  }

  return document;
}

function normalizeTrustedKeys(value) {
  if (!value) {
    return [];
  }
  return (Array.isArray(value) ? value : [value]).map(importPublicKey);
}

function verifyAerIntegrity(aer, options = {}) {
  const errors = [];
  const expectedChainHash = computeAerChainHash(aer);
  const actualChainHash = aer?.integrity?.chain_hash;
  const chainValid = actualChainHash === expectedChainHash;

  if (!chainValid) {
    errors.push(`chain_hash mismatch: expected ${expectedChainHash}, found ${actualChainHash || "missing"}`);
  }

  let signatureValid = null;
  const signature = aer?.integrity?.signature;
  const trustedPublicKeys = normalizeTrustedKeys(options.trustedPublicKeys);

  if (typeof signature === "string") {
    errors.push("legacy bare-string signature format is not verifiable by AER v0.3 integrity helpers");
  } else if (signature) {
    if (signature.algorithm !== "ed25519") {
      signatureValid = false;
      errors.push(`unsupported signature algorithm '${signature.algorithm}'`);
    } else if (trustedPublicKeys.length === 0) {
      signatureValid = false;
      errors.push("integrity.signature requires at least one trusted public key for verification");
    } else {
      signatureValid = trustedPublicKeys.some((publicKey) => safeVerifyString(actualChainHash || "", signature.value, publicKey));
      if (!signatureValid) {
        errors.push("integrity.signature verification failed");
      }
    }
  }

  let attestationValid = null;
  const attestation = aer?.executor?.recorder_attestation;
  if (attestation) {
    if (trustedPublicKeys.length === 0) {
      attestationValid = false;
      errors.push("executor.recorder_attestation requires at least one trusted public key for verification");
    } else {
      const attestationPayload = canonicalizeJson(executorAttestationPayload(aer.executor));
      attestationValid = trustedPublicKeys.some((publicKey) => safeVerifyString(attestationPayload, attestation.signature, publicKey));
      if (!attestationValid) {
        errors.push("executor.recorder_attestation verification failed");
      }
    }
  }

  return {
    chain_valid: chainValid,
    signature_valid: signatureValid,
    attestation_valid: attestationValid,
    errors
  };
}

module.exports = {
  canonicalizeJson,
  computeAerChainHash,
  sealAer,
  verifyAerIntegrity
};
