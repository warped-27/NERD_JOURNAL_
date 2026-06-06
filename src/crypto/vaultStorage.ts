import { secretGet, secretSet, secretDelete } from './secureSecrets';
import { toBase64url, fromBase64url } from './encoding';

export const VAULT_SALT_KEY     = 'nj_vault_salt';
export const VAULT_VERIFIER_KEY = 'nj_vault_verifier';

/** Returns the stored KDF salt, or null if the vault has never been initialised. */
export async function loadSalt(): Promise<Uint8Array | null> {
  const raw = await secretGet(VAULT_SALT_KEY);
  return raw ? fromBase64url(raw) : null;
}

export async function saveSalt(salt: Uint8Array): Promise<void> {
  await secretSet(VAULT_SALT_KEY, toBase64url(salt));
}

/** Returns the stored verifier envelope (base64url string), or null. */
export async function loadVerifier(): Promise<string | null> {
  return secretGet(VAULT_VERIFIER_KEY);
}

export async function saveVerifier(verifierB64: string): Promise<void> {
  await secretSet(VAULT_VERIFIER_KEY, verifierB64);
}

/** Wipes all vault state (used on password reset or factory wipe). */
export async function clearVault(): Promise<void> {
  await secretDelete(VAULT_SALT_KEY);
  await secretDelete(VAULT_VERIFIER_KEY);
}
