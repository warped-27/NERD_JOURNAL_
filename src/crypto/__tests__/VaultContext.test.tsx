import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';
import { VaultProvider, useVault } from '../VaultContext';
import type { Result } from '../../lib/result';

type UnlockResult = Result<void>;

jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn(),
  setItemAsync:    jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform:  { OS: 'web' },
  AppState:  { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

jest.mock('../kdf', () => {
  const actual = jest.requireActual('../kdf') as typeof import('../kdf');
  return { ...actual, KDF_PARAMS: { t: 1, m: 256, p: 1 } };
});

beforeEach(() => localStorage.clear());

// ---------- helpers ----------

type VaultSnapshot = ReturnType<typeof useVault>;
let captured: VaultSnapshot | undefined;

function Probe() {
  captured = useVault();
  return null;
}

function makeTree() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <VaultProvider><Probe /></VaultProvider>
    );
  });
  // flush initial useEffect (isVaultInitialised check)
  return renderer;
}

// ---------- tests ----------

describe('VaultContext', () => {
  it('starts locked and uninitialised', async () => {
    makeTree();
    // wait for the async isVaultInitialised check
    await act(async () => {});
    expect(captured!.isUnlocked).toBe(false);
    expect(captured!.isInitialised).toBe(false);
    expect(captured!.getKey()).toBeUndefined();
  });

  it('create → vault is initialised and unlocked', async () => {
    makeTree();
    await act(async () => {});

    await act(async () => { await captured!.create('mypassword'); });

    expect(captured!.isInitialised).toBe(true);
    expect(captured!.isUnlocked).toBe(true);
    expect(captured!.getKey()).toBeInstanceOf(Uint8Array);
  });

  it('lock → vault is locked, key is gone', async () => {
    makeTree();
    await act(async () => {});
    await act(async () => { await captured!.create('mypassword'); });

    act(() => captured!.lock());

    expect(captured!.isUnlocked).toBe(false);
    expect(captured!.getKey()).toBeUndefined();
  });

  it('unlock with correct password succeeds', async () => {
    makeTree();
    await act(async () => {});
    await act(async () => { await captured!.create('mypassword'); });
    act(() => captured!.lock());

    let res!: UnlockResult;
    await act(async () => { res = await captured!.unlock('mypassword'); });
    expect(res.ok).toBe(true);
    expect(captured!.isUnlocked).toBe(true);
  });

  it('unlock with wrong password fails', async () => {
    makeTree();
    await act(async () => {});
    await act(async () => { await captured!.create('mypassword'); });
    act(() => captured!.lock());

    let res!: UnlockResult;
    await act(async () => { res = await captured!.unlock('wrongpass'); });
    expect(res.ok).toBe(false);
    expect(captured!.isUnlocked).toBe(false);
  });

  it('wipe → not initialised and locked', async () => {
    makeTree();
    await act(async () => {});
    await act(async () => { await captured!.create('mypassword'); });
    await act(async () => { await captured!.wipe(); });

    expect(captured!.isInitialised).toBe(false);
    expect(captured!.isUnlocked).toBe(false);
  });
});
