import { argon2id } from '@noble/hashes/argon2.js';
import { toUtf8 } from './encoding';

export const KDF_SALT_BYTES = 16;

export interface KdfParams {
  /** time cost (iterations) */
  t: number;
  /** memory cost in KiB */
  m: number;
  /** parallelism */
  p: number;
}

/** Production Argon2id params: 2 iterations, 19 MiB, 1 thread. */
export const KDF_PARAMS: KdfParams = { t: 2, m: 19456, p: 1 };

/**
 * Derives a 32-byte key from a password and a random salt.
 * The salt must be exactly KDF_SALT_BYTES (16) bytes.
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  params: KdfParams = KDF_PARAMS,
): Promise<Uint8Array> {
  if (salt.length !== KDF_SALT_BYTES) {
    throw new Error(`deriveKey: salt must be ${KDF_SALT_BYTES} bytes, got ${salt.length}`);
  }
  // argon2id is synchronous but CPU-heavy — wrap in a microtask so callers can await
  return new Promise((resolve, reject) => {
    try {
      const key = argon2id(toUtf8(password), salt, {
        t: params.t,
        m: params.m,
        p: params.p,
        dkLen: 32,
      });
      resolve(key);
    } catch (e) {
      reject(e);
    }
  });
}
