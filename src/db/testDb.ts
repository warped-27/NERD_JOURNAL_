import { type Database } from './types';
import { type NoteRow } from '../notes/Note';

/**
 * In-memory Database implementation for Jest.
 * Handles the exact SQL patterns used by NotesRepository — no SQL parser needed.
 */
export function createTestDb(): Database {
  const notes = new Map<string, NoteRow>();

  return {
    async execAsync(_sql: string): Promise<void> {
      // CREATE TABLE etc. — noop in memory
    },

    async runAsync(
      sql: string,
      params: (string | number | null)[],
    ): Promise<{ lastInsertRowId: number; changes: number }> {
      const s = sql.trim().toUpperCase();

      if (s.startsWith('INSERT INTO NOTES')) {
        const [id, envelope, updated_at, created_at] = params as [string, string, number, number];
        notes.set(id, { id, envelope, updated_at, created_at });
        return { lastInsertRowId: 0, changes: 1 };
      }

      if (s.startsWith('UPDATE NOTES')) {
        const [envelope, updated_at, id] = params as [string, number, string];
        const existing = notes.get(id);
        if (existing) {
          notes.set(id, { ...existing, envelope, updated_at });
          return { lastInsertRowId: 0, changes: 1 };
        }
        return { lastInsertRowId: 0, changes: 0 };
      }

      if (s.startsWith('DELETE FROM NOTES')) {
        const [id] = params as [string];
        const deleted = notes.delete(id);
        return { lastInsertRowId: 0, changes: deleted ? 1 : 0 };
      }

      return { lastInsertRowId: 0, changes: 0 };
    },

    async getAllAsync<T>(sql: string, _params?: (string | number | null)[]): Promise<T[]> {
      // SELECT * FROM notes ORDER BY updated_at DESC
      return [...notes.values()].sort((a, b) => b.updated_at - a.updated_at) as unknown as T[];
    },

    async getFirstAsync<T>(
      _sql: string,
      params?: (string | number | null)[],
    ): Promise<T | null> {
      // SELECT * FROM notes WHERE id = ?
      const id = params?.[0] as string | undefined;
      return (id ? (notes.get(id) ?? null) : null) as unknown as T | null;
    },

    async withTransactionAsync(task: () => Promise<void>): Promise<void> {
      await task();
    },
  };
}
