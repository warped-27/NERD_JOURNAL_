import { deriveKey, KDF_SALT_BYTES } from '../kdf';

// Params ridotti per i test — i param di produzione (19MiB) sarebbero troppo lenti
const FAST = { t: 1, m: 256, p: 1 } as const;

describe('deriveKey', () => {
  it('returns 32 bytes', async () => {
    const salt = new Uint8Array(KDF_SALT_BYTES).fill(1);
    const key = await deriveKey('password', salt, FAST);
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it('same password + salt → same key (deterministic)', async () => {
    const salt = new Uint8Array(KDF_SALT_BYTES).fill(2);
    const k1 = await deriveKey('abc', salt, FAST);
    const k2 = await deriveKey('abc', salt, FAST);
    expect(k1).toEqual(k2);
  });

  it('different password → different key', async () => {
    const salt = new Uint8Array(KDF_SALT_BYTES).fill(3);
    const k1 = await deriveKey('password1', salt, FAST);
    const k2 = await deriveKey('password2', salt, FAST);
    expect(k1).not.toEqual(k2);
  });

  it('different salt → different key', async () => {
    const s1 = new Uint8Array(KDF_SALT_BYTES).fill(4);
    const s2 = new Uint8Array(KDF_SALT_BYTES).fill(5);
    const k1 = await deriveKey('password', s1, FAST);
    const k2 = await deriveKey('password', s2, FAST);
    expect(k1).not.toEqual(k2);
  });

  it('throws if salt length is wrong', async () => {
    await expect(deriveKey('password', new Uint8Array(8), FAST)).rejects.toThrow();
  });
});
