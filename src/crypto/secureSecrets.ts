import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Platform-agnostic secure key-value store.
 * - Native (iOS/Android): backed by OS Keychain / Android Keystore via expo-secure-store.
 * - Web: falls back to Web Storage. Plaintext secrets (API keys) use sessionStorage so
 *   they are not persisted across browser sessions. Cryptographic material (salt, verifier)
 *   uses localStorage — it is useless without the vault password.
 */

// Keys that hold plaintext secrets on web — use sessionStorage instead of localStorage
const SESSION_STORAGE_KEYS = new Set(['nj_gemini_apikey']);

// sessionStorage may be undefined in SSR / non-browser test environments
const _sessionStorage: Storage | null = (() => {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; }
  catch { return null; }
})();

export async function secretGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (SESSION_STORAGE_KEYS.has(key) && _sessionStorage) {
      const val = _sessionStorage.getItem(key);
      if (val !== null) return val;
      // Migrate value stored by an older version of the app
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
  return SecureStore.getItemAsync(key);
}

export async function secretSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    const store = (SESSION_STORAGE_KEYS.has(key) && _sessionStorage) ? _sessionStorage : localStorage;
    store.setItem(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function secretDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (SESSION_STORAGE_KEYS.has(key) && _sessionStorage) {
      _sessionStorage.removeItem(key);
    }
    localStorage.removeItem(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
