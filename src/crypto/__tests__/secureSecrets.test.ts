/**
 * Tests run in jsdom (web) environment — expo-secure-store is not available,
 * so secureSecrets falls through to the localStorage path on web.
 */
import { secretGet, secretSet, secretDelete } from '../secureSecrets';

// expo-secure-store is a native module — mock it so Jest doesn't try to load native code
jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn(),
  setItemAsync:    jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Force web platform so we exercise the localStorage branch
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

beforeEach(() => localStorage.clear());

describe('secureSecrets (web / localStorage path)', () => {
  it('returns null for unknown key', async () => {
    expect(await secretGet('missing')).toBeNull();
  });

  it('stores and retrieves a value', async () => {
    await secretSet('k', 'value123');
    expect(await secretGet('k')).toBe('value123');
  });

  it('overwrites an existing value', async () => {
    await secretSet('k', 'first');
    await secretSet('k', 'second');
    expect(await secretGet('k')).toBe('second');
  });

  it('deletes a key', async () => {
    await secretSet('k', 'v');
    await secretDelete('k');
    expect(await secretGet('k')).toBeNull();
  });
});
