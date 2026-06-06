import { loadSalt, saveSalt, loadVerifier, saveVerifier, clearVault, VAULT_SALT_KEY, VAULT_VERIFIER_KEY } from '../vaultStorage';
import { KDF_SALT_BYTES } from '../kdf';

jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn(),
  setItemAsync:    jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

beforeEach(() => localStorage.clear());

describe('vaultStorage', () => {
  it('loadSalt returns null when nothing stored', async () => {
    expect(await loadSalt()).toBeNull();
  });

  it('saveSalt / loadSalt round-trip', async () => {
    const salt = new Uint8Array(KDF_SALT_BYTES).fill(0xaa);
    await saveSalt(salt);
    const loaded = await loadSalt();
    expect(loaded).toEqual(salt);
  });

  it('loadVerifier returns null when nothing stored', async () => {
    expect(await loadVerifier()).toBeNull();
  });

  it('saveVerifier / loadVerifier round-trip', async () => {
    await saveVerifier('AAABBBCCC==envelope');
    expect(await loadVerifier()).toBe('AAABBBCCC==envelope');
  });

  it('clearVault removes both salt and verifier', async () => {
    const salt = new Uint8Array(KDF_SALT_BYTES).fill(1);
    await saveSalt(salt);
    await saveVerifier('some-verifier');
    await clearVault();
    expect(await loadSalt()).toBeNull();
    expect(await loadVerifier()).toBeNull();
  });
});
