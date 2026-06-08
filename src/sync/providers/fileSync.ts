import { Platform } from 'react-native';
import type { SyncBundle } from '../SyncBundle';
import { serializeBundle, parseBundle } from '../SyncBundle';

const BUNDLE_FILENAME = 'nerd_journal_.njvault';

// ─── Export ──────────────────────────────────────────────────────────────────

export async function exportToFile(bundle: SyncBundle): Promise<void> {
  if (Platform.OS === 'web') {
    const json = serializeBundle(bundle);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    try {
      const a    = document.createElement('a');
      a.href     = url;
      a.download = BUNDLE_FILENAME;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      URL.revokeObjectURL(url);
    }
  } else {
    throw new Error('File export on native requires expo-sharing — use WebDAV sync instead.');
  }
}

// ─── Import ──────────────────────────────────────────────────────────────────

export async function importFromFile(): Promise<SyncBundle | null> {
  if (Platform.OS === 'web') {
    return webImportFromFile();
  }
  return nativeImportFromFile();
}

function webImportFromFile(): Promise<SyncBundle | null> {
  return new Promise((resolve, reject) => {
    const input    = document.createElement('input');
    input.type     = 'file';
    input.accept   = '.njvault,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader  = new FileReader();
      reader.onload = () => {
        try { resolve(parseBundle(reader.result as string)); }
        catch (e) { reject(e); }
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsText(file);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

async function nativeImportFromFile(): Promise<SyncBundle | null> {
  // expo-document-picker is available on native
  const { getDocumentAsync } = await import('expo-document-picker');
  const result = await getDocumentAsync({
    type: ['application/json', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const uri = result.assets[0]?.uri;
  if (!uri) return null;

  const { readAsStringAsync, EncodingType } = await import('expo-file-system');
  const text = await readAsStringAsync(uri, { encoding: EncodingType.UTF8 });
  return parseBundle(text);
}
