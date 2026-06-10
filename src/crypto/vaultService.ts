import { getRandomBytes } from './random';
import { deriveKey, KDF_PARAMS, KDF_SALT_BYTES } from './kdf';
import { encrypt, decrypt } from './cipher';
import { toBase64url, fromBase64url, toUtf8 } from './encoding';
import { loadSalt, saveSalt, loadVerifier, saveVerifier } from './vaultStorage';
import { type Result, ok, err } from '../lib/result';

/** Plaintext we encrypt with the derived key to produce the verifier. */
const VERIFIER_PLAINTEXT = 'nerd-journal-vault-v1';

/** Returns true if a vault (salt + verifier) has already been created on this device. */
export async function isVaultInitialised(): Promise<boolean> {
  const salt     = await loadSalt();
  const verifier = await loadVerifier();
  return salt !== null && verifier !== null;
}

/**
 * Creates a new vault for the given password.
 * Generates a fresh random salt, derives the key, stores the salt and verifier.
 * Returns the derived key (kept in RAM by the caller — never persisted).
 */
export async function createVault(password: string): Promise<Uint8Array> {
  const salt = getRandomBytes(KDF_SALT_BYTES);
  const key  = await deriveKey(password, salt, KDF_PARAMS);
  try {
    const envelope    = encrypt(key, toUtf8(VERIFIER_PLAINTEXT));
    const verifierB64 = toBase64url(envelope);
    await saveSalt(salt);
    await saveVerifier(verifierB64);
    return key;
  } catch (e) {
    key.fill(0);
    throw e;
  }
}

/**
 * Attempts to unlock an existing vault with the given password.
 * Returns Ok(derivedKey) on success, Err(reason) if the password is wrong
 * or the vault is not initialised.
 */
export async function unlockVault(password: string): Promise<Result<Uint8Array>> {
  const salt        = await loadSalt();
  const verifierB64 = await loadVerifier();

  if (!salt || !verifierB64) {
    return err('Vault not initialised');
  }

  const key = await deriveKey(password, salt, KDF_PARAMS);
  try {
    const envelope = fromBase64url(verifierB64);
    const result   = decrypt(key, envelope);
    if (!result.ok) {
      key.fill(0);
      return err('Wrong password');
    }
    return ok(key);
  } catch (e) {
    key.fill(0);
    throw e;
  }
}
