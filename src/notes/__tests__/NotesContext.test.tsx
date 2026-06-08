import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';
import { NotesProvider, useNotes } from '../NotesContext';

// --- mocks ---

jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn().mockResolvedValue(null),
  setItemAsync:    jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

const mockKey = new Uint8Array(32).fill(0xab);
let mockIsUnlocked = false;
let mockGetKey = jest.fn(() => mockIsUnlocked ? mockKey : undefined);

jest.mock('../../crypto/VaultContext', () => ({
  useVault: () => ({ isUnlocked: mockIsUnlocked, getKey: mockGetKey }),
  VaultProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../db/database', () => ({
  openDatabase: jest.fn(),
  resetDatabaseInstance: jest.fn(),
}));

// Inject in-memory DB via the mock
import { createTestDb } from '../../db/testDb';
const testDb = createTestDb();
const { openDatabase } = require('../../db/database');
(openDatabase as jest.Mock).mockResolvedValue(testDb);

// --- helpers ---

type NotesSnapshot = ReturnType<typeof useNotes>;
let captured!: NotesSnapshot;

function Probe() {
  captured = useNotes();
  return null;
}

async function makeTree() {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <NotesProvider><Probe /></NotesProvider>
    );
  });
  await act(async () => {});
  return renderer;
}

// --- tests ---

beforeEach(() => {
  mockIsUnlocked = false;
  mockGetKey.mockImplementation(() => mockIsUnlocked ? mockKey : undefined);
  jest.clearAllMocks().resetModules;
  (openDatabase as jest.Mock).mockResolvedValue(createTestDb());
});

describe('NotesContext', () => {
  it('starts with empty notes when vault is locked', async () => {
    await makeTree();
    expect(captured.notes).toEqual([]);
    expect(captured.isLoading).toBe(false);
  });

  it('loads notes when vault becomes unlocked', async () => {
    mockIsUnlocked = true;
    await makeTree();
    await act(async () => {});
    expect(captured.isLoading).toBe(false);
    expect(Array.isArray(captured.notes)).toBe(true);
  });

  it('createNote adds to the list (vault must be unlocked)', async () => {
    mockIsUnlocked = true;
    await makeTree();
    await act(async () => {});
    await act(async () => {
      await captured.createNote({ title: 'Hello', content: 'World' });
    });
    expect(captured.notes.length).toBe(1);
    expect(captured.notes[0]!.title).toBe('Hello');
  });

  it('deleteNote removes the note', async () => {
    mockIsUnlocked = true;
    await makeTree();
    await act(async () => {});
    await act(async () => { await captured.createNote({ title: 't', content: 'c' }); });
    const id = captured.notes[0]!.id;
    await act(async () => { await captured.deleteNote(id); });
    expect(captured.notes).toEqual([]);
  });

  it('updateNote patches the note', async () => {
    mockIsUnlocked = true;
    await makeTree();
    await act(async () => {});
    await act(async () => { await captured.createNote({ title: 'Old', content: 'c' }); });
    const id = captured.notes[0]!.id;
    await act(async () => { await captured.updateNote(id, { title: 'New', content: 'c' }); });
    expect(captured.notes[0]!.title).toBe('New');
  });
});
