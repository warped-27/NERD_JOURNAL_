import { isTauri } from '../platform/detect';

/**
 * Secure key-value store — web/Tauri variant.
 * Metro automatically selects secureSecrets.native.ts for iOS/Android builds.
 *
 * Priority order:
 *   1. Tauri desktop → OS keychain via Rust `keyring` crate (invoke commands)
 *   2. Web browser  → sessionStorage for plaintext secrets; vault keys throw (not allowed in browser)
 *
 * The web browser path exists only as a developer/fallback surface.
 * The production targets are Tauri (desktop) and EAS native (mobile).
 */

// ─── Tauri — OS keychain via custom Rust commands ───────────────────────────

async function tauriGet(key: string): Promise<string | null> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string | null>('get_secret', { key });
}

async function tauriSet(key: string, value: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<void>('set_secret', { key, value });
}

async function tauriDelete(key: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<void>('delete_secret', { key });
}

// ─── Browser fallback ────────────────────────────────────────────────────────

// Vault-critical keys must never be persisted in browser localStorage.
// They are only safe inside the OS keychain (Tauri) or the device secure enclave (native).
const VAULT_CRITICAL_KEYS = new Set(['nj_vault_salt', 'nj_vault_verifier']);

// Plaintext secrets use sessionStorage (not persisted across browser sessions).
// All keys that may contain API credentials or sensitive config must be listed here.
const SESSION_STORAGE_KEYS = new Set([
  'nj_gemini_apikey',
  'nj_claude_config',
  'nj_custom_config',
  'nj_ollama_config',
  'nj_mlx_config',
  'nj_ai_consent',
  'nj_ai_autoenrich',
  'nj_gemini_model',
  'nj_gemini_consent',      // legacy — kept for migration reads
  'nj_gemini_autoenrich',   // legacy — kept for migration reads
  // Sync credentials must not survive browser restarts
  'nj_sync_config',
  'nj_sync_meta',
]);

const _sessionStorage: Storage | null = (() => {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; }
  catch { return null; }
})();

function webGet(key: string): string | null {
  if (SESSION_STORAGE_KEYS.has(key) && _sessionStorage) {
    const val = _sessionStorage.getItem(key);
    if (val !== null) return val;
    // Migrate from localStorage if set by an older version
    const legacy = localStorage.getItem(key);
    if (legacy !== null) {
      _sessionStorage.setItem(key, legacy);
      localStorage.removeItem(key);
      return legacy;
    }
    return null;
  }
  return localStorage.getItem(key);
}

function webSet(key: string, value: string): void {
  if (VAULT_CRITICAL_KEYS.has(key)) {
    throw new Error(
      'Vault storage requires a secure keychain — ' +
      'please use the Tauri desktop app or a native iOS/Android build.',
    );
  }
  const store = (SESSION_STORAGE_KEYS.has(key) && _sessionStorage)
    ? _sessionStorage
    : localStorage;
  store.setItem(key, value);
}

function webDelete(key: string): void {
  if (SESSION_STORAGE_KEYS.has(key) && _sessionStorage) {
    _sessionStorage.removeItem(key);
  }
  localStorage.removeItem(key);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function secretGet(key: string): Promise<string | null> {
  if (isTauri()) return tauriGet(key);
  return webGet(key);
}

export async function secretSet(key: string, value: string): Promise<void> {
  if (isTauri()) return tauriSet(key, value);
  webSet(key, value);
}

export async function secretDelete(key: string): Promise<void> {
  if (isTauri()) return tauriDelete(key);
  webDelete(key);
}
