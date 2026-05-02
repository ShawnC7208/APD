export * from "./index";

export interface AerIntegrityVerification {
  chain_valid: boolean;
  signature_valid: boolean | null;
  attestation_valid: boolean | null;
  errors: string[];
}

export function canonicalizeJson(value: unknown): string;
export function computeAerChainHash(aer: unknown): string;
export function sealAer(
  aer: unknown,
  options?: {
    previousChainHash?: string;
    privateKey?: string | Buffer | object;
    publicKey?: string | Buffer | object;
    attestExecutor?: boolean;
    attestedAt?: string;
  }
): unknown;
export function verifyAerIntegrity(
  aer: unknown,
  options?: {
    trustedPublicKeys?: string | Buffer | object | Array<string | Buffer | object>;
  }
): AerIntegrityVerification;
