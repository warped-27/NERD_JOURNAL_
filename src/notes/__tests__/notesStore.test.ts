import { createNotesStore } from '../notesStore';
import { NotesRepository } from '../NotesRepository';
import { createTestDb } from '../../db/testDb';
import { type Note } from '../Note';

const KEY = new Uint8Array(32).fill(0xaa);

function makeRepo() {
  return new NotesRepository(createTestDb(), KEY);
}

function makeNote(id: string, updatedAt = Date.now()): Note {
  return { id, title: `Note ${id}`, content: 'body', attachments: [], createdAt: updatedAt, updatedAt };
}

describe('notesStore', () => {
  it('starts with empty notes and not loading', () => {
    const store = createNotesStore(makeRepo());
    const { notes, isLoading } = store.getState();
    expect(notes).toEqual([]);
    expect(isLoading).toBe(false);
  });

  it('loadNotes populates the store', async () => {
    const repo = makeRepo();
    const note = makeNote('n1');
    await repo.insert(note);
    const store = createNotesStore(repo);
    await store.getState().loadNotes();
    expect(store.getState().notes.length).toBe(1);
    expect(store.getState().notes[0]!.id).toBe('n1');
  });

  it('createNote adds a note and is visible in findAll', async () => {
    const store = createNotesStore(makeRepo());
    await store.getState().createNote({ title: 'Hello', content: 'World' });
    expect(store.getState().notes.length).toBe(1);
    expect(store.getState().notes[0]!.title).toBe('Hello');
    expect(typeof store.getState().notes[0]!.id).toBe('string');
  });

  it('updateNote changes title and content', async () => {
    const store = createNotesStore(makeRepo());
    await store.getState().createNote({ title: 'Old', content: 'body' });
    const { id } = store.getState().notes[0]!;
    await store.getState().updateNote(id, { title: 'New', content: 'updated' });
    expect(store.getState().notes[0]!.title).toBe('New');
    expect(store.getState().notes[0]!.content).toBe('updated');
  });

  it('deleteNote removes the note', async () => {
    const store = createNotesStore(makeRepo());
    await store.getState().createNote({ title: 't', content: 'c' });
    const { id } = store.getState().notes[0]!;
    await store.getState().deleteNote(id);
    expect(store.getState().notes).toEqual([]);
  });

  it('isLoading is true during loadNotes', async () => {
    const repo = makeRepo();
    const store = createNotesStore(repo);
    const loadPromise = store.getState().loadNotes();
    // Immediately after calling, isLoading should be true
    expect(store.getState().isLoading).toBe(true);
    await loadPromise;
    expect(store.getState().isLoading).toBe(false);
  });

  it('patchNote updates tags/summary/palette without changing updatedAt', async () => {
    const store = createNotesStore(makeRepo());
    await store.getState().createNote({ title: 'Note', content: 'Body' });
    const { id, updatedAt } = store.getState().notes[0]!;
    await store.getState().patchNote(id, {
      tags:    ['coding', 'typescript'],
      summary: '• point one\n• point two',
      palette: ['#00ffff'],
    });
    const patched = store.getState().notes[0]!;
    expect(patched.tags).toEqual(['coding', 'typescript']);
    expect(patched.summary).toBe('• point one\n• point two');
    expect(patched.palette).toEqual(['#00ffff']);
    expect(patched.updatedAt).toBe(updatedAt);
  });

  it('patchNote is a no-op for unknown id', async () => {
    const store = createNotesStore(makeRepo());
    await expect(store.getState().patchNote('nonexistent', { tags: ['x'] })).resolves.toBeUndefined();
    expect(store.getState().notes).toHaveLength(0);
  });
});
