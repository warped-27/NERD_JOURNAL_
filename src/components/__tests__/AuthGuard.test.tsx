import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';

jest.mock('react-native', () => ({
  Platform:  { OS: 'web' },
  AppState:  { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  View:                 'View',
  Text:                 'Text',
  TextInput:            'TextInput',
  Pressable:            'Pressable',
  ActivityIndicator:    'ActivityIndicator',
  ScrollView:           'ScrollView',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Animated: {
    Value:    jest.fn().mockImplementation(() => ({ setValue: jest.fn() })),
    timing:   jest.fn().mockReturnValue({}),
    sequence: jest.fn().mockReturnValue({}),
    delay:    jest.fn().mockReturnValue({}),
    loop:     jest.fn().mockReturnValue({ start: jest.fn(), stop: jest.fn() }),
    View:     'Animated.View',
  },
  StyleSheet: {
    create: (s: object) => s,
    flatten: (s: unknown) => s,
  },
}));

// Mock VaultContext — each test controls vault state via mockVault
const mockVault = {
  isInitialised: null as boolean | null,
  isUnlocked:    false,
  create:        jest.fn().mockResolvedValue({ ok: true, value: undefined }),
  unlock:        jest.fn().mockResolvedValue({ ok: true, value: undefined }),
  lock:          jest.fn(),
  wipe:          jest.fn().mockResolvedValue(undefined),
  getKey:        jest.fn(),
};
jest.mock('../../crypto/VaultContext', () => ({
  useVault:      () => mockVault,
  VaultProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../sync/SyncContext', () => ({
  useSync:      () => ({ hasConfigured: false, setConfig: jest.fn() }),
  SyncProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../SyncOnboarding', () => ({
  SyncOnboarding: () => null,
}));

import { AuthGuard } from '../AuthGuard';

beforeEach(() => {
  mockVault.isInitialised = null;
  mockVault.isUnlocked    = false;
});

describe('AuthGuard', () => {
  it('renders null while vault state loading (isInitialised === null)', async () => {
    mockVault.isInitialised = null;
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AuthGuard><>child</></AuthGuard>);
    });
    expect(renderer.toJSON()).toBeNull();
  });

  it('renders setup screen when vault not initialised', async () => {
    mockVault.isInitialised = false;
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AuthGuard><>child</></AuthGuard>);
    });
    const json = JSON.stringify(renderer.toJSON());
    expect(json).toMatch(/INITIALISE|CREATE|SETUP/i);
  });

  it('renders unlock screen when vault initialised but locked', async () => {
    mockVault.isInitialised = true;
    mockVault.isUnlocked    = false;
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AuthGuard><>child</></AuthGuard>);
    });
    const json = JSON.stringify(renderer.toJSON());
    expect(json).toMatch(/UNLOCK|PASSWORD/i);
  });

  it('renders children when vault is unlocked', async () => {
    mockVault.isInitialised = true;
    mockVault.isUnlocked    = true;
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AuthGuard><>CHILD_CONTENT</></AuthGuard>);
    });
    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain('CHILD_CONTENT');
  });

  it('setup screen calls vault.create on submit', async () => {
    mockVault.isInitialised = false;
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AuthGuard><>child</></AuthGuard>);
    });
    // find password inputs and button
    const inputs = renderer.root.findAll((n) => (n.type as unknown as string) === 'TextInput');
    const btn    = renderer.root.findByProps({ accessibilityRole: 'button' });
    await act(async () => {
      inputs[0]?.props.onChangeText('mypassword1234');
      inputs[1]?.props.onChangeText('mypassword1234');
    });
    await act(async () => { btn.props.onPress(); });
    expect(mockVault.create).toHaveBeenCalledWith('mypassword1234');
  });

  it('unlock screen calls vault.unlock on submit', async () => {
    mockVault.isInitialised = true;
    mockVault.isUnlocked    = false;
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AuthGuard><>child</></AuthGuard>);
    });
    const input = renderer.root.findAll((n) => (n.type as unknown as string) === 'TextInput')[0]!;
    const btn   = renderer.root.findByProps({ accessibilityRole: 'button' });
    await act(async () => { input.props.onChangeText('mypassword'); });
    await act(async () => { btn.props.onPress(); });
    expect(mockVault.unlock).toHaveBeenCalledWith('mypassword');
  });
});
