import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Platform-agnostic secure key-value store.
 * - Native (iOS/Android): backed by OS Keychain / Android Keystore via expo-secure-store.
 * - Web: falls back to localStorage (no hardware-backed storage available in browsers).
 *   Cryptographic protection on web comes from the vault layer above.
 */

export async function secretGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function secretSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function secretDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
