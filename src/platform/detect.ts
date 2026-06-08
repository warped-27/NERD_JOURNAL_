/**
 * Runtime platform detection.
 * - isTauri(): true when running inside Tauri WebView (desktop app)
 * - isNative(): true when running in a native Expo build (iOS/Android)
 *
 * Platform.OS is 'web' for BOTH Tauri and browser contexts because Tauri
 * renders the Expo web bundle — isTauri() is the only way to tell them apart.
 */

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  // __TAURI_INTERNALS__ and __TAURI__ are both injected when withGlobalTauri: true
  // is set in tauri.conf.json (required for Tauri v2 global API access)
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

export function isNativePlatform(): boolean {
  // Platform.OS is 'ios' or 'android' in EAS native builds
  try {
    const { Platform } = require('react-native') as { Platform: { OS: string } };
    return Platform.OS === 'ios' || Platform.OS === 'android';
  } catch {
    return false;
  }
}
