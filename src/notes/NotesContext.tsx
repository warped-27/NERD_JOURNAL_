import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from 'react';
import { useVault } from '../crypto/VaultContext';
import { openDatabase } from '../db/database';
import { NotesRepository } from './NotesRepository';
import { createNotesStore } from './notesStore';
import type { Note } from './Note';
import type { Database } from '../db/types';
import { exportBundle as repoExportBundle, mergeBundle as repoMergeBundle, type MergeResult } from '../sync/syncRepository';
import type { SyncBundle } from '../sync/SyncBundle';

interface NotesState {
  notes:     Note[];
  isLoading: boolean;
}

interface NotesActions {
  createNote:    (draft: Pick<Note, 'title' | 'content'> & { attachments?: Note['attachments'] }) => Promise<Note | null>;
  updateNote:    (id: string, patch: Pick<Note, 'title' | 'content'> & { attachments?: Note['attachments'] }) => Promise<void>;
  patchNote:     (id: string, patch: Partial<Pick<Note, 'tags' | 'summary' | 'palette'>>) => Promise<void>;
  deleteNote:    (id: string) => Promise<void>;
  exportBundle:  () => Promise<SyncBundle>;
  importBundle:  (bundle: SyncBundle) => Promise<MergeResult>;
}

const NotesContext = createContext<(NotesState & NotesActions) | undefined>(undefined);

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const vault    = useVault();
  const storeRef = useRef<ReturnType<typeof createNotesStore> | null>(null);
  const dbRef    = useRef<Database | null>(null);
  const [notes,     setNotes]     = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!vault.isUnlocked) {
      storeRef.current = null;
      setNotes([]);
      return;
    }

    const key = vault.getKey();
    if (!key) return;

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const db   = await openDatabase();
      if (cancelled) return;
      dbRef.current = db;
      const repo  = new NotesRepository(db, key);
      const store = createNotesStore(repo);
      storeRef.current = store;
      // Subscribe to store state changes → mirror into React state
      store.subscribe((s) => { setNotes([...s.notes]); setIsLoading(s.isLoading); });
      await store.getState().loadNotes();
    })();

    return () => { cancelled = true; dbRef.current = null; };
  }, [vault.isUnlocked]);

  const createNote = useCallback(async (draft: Pick<Note, 'title' | 'content'> & { attachments?: Note['attachments'] }): Promise<Note | null> => {
    if (!storeRef.current) return null;
    return storeRef.current.getState().createNote(draft);
  }, []);

  const updateNote = useCallback(async (id: string, patch: Pick<Note, 'title' | 'content'> & { attachments?: Note['attachments'] }): Promise<void> => {
    return storeRef.current?.getState().updateNote(id, patch);
  }, []);

  const patchNote = useCallback(async (id: string, patch: Partial<Pick<Note, 'tags' | 'summary' | 'palette'>>): Promise<void> => {
    return storeRef.current?.getState().patchNote(id, patch);
  }, []);

  const deleteNote = useCallback(async (id: string): Promise<void> => {
    return storeRef.current?.getState().deleteNote(id);
  }, []);

  const exportBundle = useCallback(async (): Promise<SyncBundle> => {
    const db = dbRef.current;
    if (!db) throw new Error('Database not available — vault may be locked');
    return repoExportBundle(db);
  }, []);

  const importBundle = useCallback(async (bundle: SyncBundle): Promise<MergeResult> => {
    const db = dbRef.current;
    if (!db) throw new Error('Database not available — vault may be locked');
    const result = await repoMergeBundle(db, bundle);
    await storeRef.current?.getState().loadNotes();
    return result;
  }, []);

  return (
    <NotesContext.Provider value={{ notes, isLoading, createNote, updateNote, patchNote, deleteNote, exportBundle, importBundle }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotes must be used inside <NotesProvider>');
  return ctx;
}
