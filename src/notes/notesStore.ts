import { createStore } from 'zustand/vanilla';
import { type Note } from './Note';
import { type NotesRepository } from './NotesRepository';
import { newId } from '../lib/id';

interface NotesState {
  notes:     Note[];
  isLoading: boolean;
}

interface NotesActions {
  loadNotes:  () => Promise<void>;
  createNote: (draft: Pick<Note, 'title' | 'content'>) => Promise<Note>;
  updateNote: (id: string, patch: Pick<Note, 'title' | 'content'> & { attachments?: Note['attachments'] }) => Promise<void>;
  patchNote:  (id: string, patch: Partial<Pick<Note, 'tags' | 'summary' | 'palette'>>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
}

export type NotesStore = NotesState & NotesActions;

export function createNotesStore(repo: NotesRepository) {
  return createStore<NotesStore>((set, get) => ({
    notes:     [],
    isLoading: false,

    async loadNotes() {
      set({ isLoading: true });
      const notes = await repo.findAll();
      set({ notes, isLoading: false });
    },

    async createNote(draft) {
      const now  = Date.now();
      const note: Note = { id: newId(), title: draft.title, content: draft.content, attachments: [], createdAt: now, updatedAt: now };
      await repo.insert(note);
      set((s) => ({ notes: [note, ...s.notes] }));
      return note;
    },

    async updateNote(id, patch) {
      const now      = Date.now();
      const existing = get().notes.find((n) => n.id === id);
      if (!existing) return;
      const updated: Note = { ...existing, ...patch, updatedAt: now };
      await repo.update(updated);
      set((s) => ({
        notes: s.notes.map((n) => (n.id === id ? updated : n)),
      }));
    },

    async patchNote(id, patch) {
      const existing = get().notes.find((n) => n.id === id);
      if (!existing) return;
      // updatedAt is not touched — enrichment is not a user edit
      const updated: Note = { ...existing, ...patch };
      await repo.update(updated);
      set((s) => ({ notes: s.notes.map((n) => (n.id === id ? updated : n)) }));
    },

    async deleteNote(id) {
      await repo.delete(id);
      set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    },
  }));
}
