import { gcm } from '@noble/ciphers/aes.js';
import { getRandomBytes } from './random';
import { type Result, ok, err } from '../lib/result';

export const ENVELOPE_VERSION = 0x01;
const NONCE_BYTES = 12;
const TAG_BYTES   = 16;
/** Total bytes added around the plaintext: version(1) + nonce(12) + GCM-tag(16) */
export const ENVELOPE_OVERHEAD = 1 + NONCE_BYTES + TAG_BYTES;

/**
 * Encrypts plaintext with AES-256-GCM.
 * Envelope layout: version(1B) || nonce(12B) || ciphertext+tag
 */
export function encrypt(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
  if (key.length !== 32) throw new Error(`encrypt: key must be 32 bytes, got ${key.length}`);
  const nonce = getRandomBytes(NONCE_BYTES);
  const ciphertextAndTag = gcm(key, nonce).encrypt(plaintext);
  const envelope = new Uint8Array(1 + NONCE_BYTES + ciphertextAndTag.length);
  envelope[0] = ENVELOPE_VERSION;
  envelope.set(nonce, 1);
  envelope.set(ciphertextAndTag, 1 + NONCE_BYTES);
  return envelope;
}

/**
 * Decrypts an envelope produced by `encrypt`.
 * Returns Err on any authentication failure, wrong version, or malformed input.
 */
export function decrypt(key: Uint8Array, envelope: Uint8Array): Result<Uint8Array> {
  if (envelope.length < 1 + NONCE_BYTES + TAG_BYTES) {
    return err('decrypt: envelope too short');
  }
  if (envelope[0] !== ENVELOPE_VERSION) {
    return err(`decrypt: unknown version ${envelope[0]}`);
  }
  const nonce = envelope.slice(1, 1 + NONCE_BYTES);
  const ciphertextAndTag = envelope.slice(1 + NONCE_BYTES);
  try {
    const plaintext = gcm(key, nonce).decrypt(ciphertextAndTag);
    return ok(plaintext);
  } catch {
    return err('decrypt: authentication failed');
  }
}
