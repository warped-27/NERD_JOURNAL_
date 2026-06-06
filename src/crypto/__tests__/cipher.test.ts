import { encrypt, decrypt, ENVELOPE_OVERHEAD, ENVELOPE_VERSION } from '../cipher';
import { getRandomBytes } from '../random';

const KEY = new Uint8Array(32).fill(0xab);

describe('encrypt', () => {
  it('returns envelope with correct overhead', () => {
    const pt = new Uint8Array([1, 2, 3, 4]);
    const env = encrypt(KEY, pt);
    // overhead = version(1) + nonce(12) + GCM-tag(16) = 29
    expect(env.length).toBe(pt.length + ENVELOPE_OVERHEAD);
  });

  it('first byte is the version constant', () => {
    const env = encrypt(KEY, new Uint8Array(8));
    expect(env[0]).toBe(ENVELOPE_VERSION);
  });

  it('two encryptions of same plaintext produce different envelopes (random nonce)', () => {
    const pt = new Uint8Array(16).fill(0x42);
    expect(encrypt(KEY, pt)).not.toEqual(encrypt(KEY, pt));
  });
});

describe('decrypt', () => {
  it('round-trips plaintext', () => {
    const pt = new TextEncoder().encode('ciao nerd journal');
    const env = encrypt(KEY, pt);
    const result = decrypt(KEY, env);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(pt);
  });

  it('returns Err on tampered ciphertext', () => {
    const env = encrypt(KEY, new Uint8Array(16).fill(1));
    env[20] = (env[20]! ^ 0xff) & 0xff; // flip a bit in the ciphertext body
    const result = decrypt(KEY, env);
    expect(result.ok).toBe(false);
  });

  it('returns Err on wrong key', () => {
    const env = encrypt(KEY, new Uint8Array(16).fill(1));
    const wrongKey = new Uint8Array(32).fill(0xcd);
    expect(decrypt(wrongKey, env).ok).toBe(false);
  });

  it('returns Err on truncated envelope', () => {
    const env = encrypt(KEY, new Uint8Array(8));
    expect(decrypt(KEY, env.slice(0, 10)).ok).toBe(false);
  });

  it('returns Err on unknown version byte', () => {
    const env = encrypt(KEY, new Uint8Array(8));
    const bad = new Uint8Array(env);
    bad[0] = 0xff;
    expect(decrypt(KEY, bad).ok).toBe(false);
  });
});

describe('key size', () => {
  it('throws on wrong key length', () => {
    expect(() => encrypt(new Uint8Array(16), new Uint8Array(4))).toThrow();
  });
});
