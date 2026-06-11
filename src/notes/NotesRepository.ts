import { type Database } from '../db/types';
import { type Note, type NoteRow } from './Note';
import { encrypt, decrypt } from '../crypto/cipher';
import { toBase64url, fromBase64url, toUtf8, fromUtf8 } from '../crypto/encoding';
import { logger } from '../lib/logger';

const VALID_ATTACHMENT_TYPES = new Set(['image', 'file', 'link', 'voice']);

function isValidAttachment(a: unknown): boolean {
  if (typeof a !== 'object' || a === null) return false;
  const o = a as Record<string, unknown>;
  if (typeof o['id'] !== 'string' || !o['id']) return false;
  if (!VALID_ATTACHMENT_TYPES.has(o['type'] as string)) return false;
  // For link attachments, url must be http/https if present
  if (o['type'] === 'link' && o['url'] != null) {
    const u = o['url'];
    if (typeof u !== 'string') return false;
    if (!/^https?:\/\//i.test(u)) return false;
  }
  return true;
}

function isValidNoteShape(n: unknown): boolean {
  if (typeof n !== 'object' || n === null) return false;
  const o = n as Record<string, unknown>;
  if (
    typeof o['id'] !== 'string' || !o['id'] ||
    typeof o['title'] !== 'string' ||
    typeof o['content'] !== 'string' ||
    typeof o['createdAt'] !== 'number' ||
    typeof o['updatedAt'] !== 'number'
  ) return false;
  if (o['attachments'] != null) {
    if (!Array.isArray(o['attachments'])) return false;
    if (!(o['attachments'] as unknown[]).every(isValidAttachment)) return false;
  }
  return true;
}

export class NotesRepository {
  constructor(private db: Database, private key: Uint8Array) {}

  async insert(note: Note): Promise<void> {
    const envelope = this.encryptNote(note);
    await this.db.runAsync(
      'INSERT INTO notes (id, envelope, updated_at, created_at) VALUES (?, ?, ?, ?)',
      [note.id, envelope, note.updatedAt, note.createdAt],
    );
  }

  async findById(id: string): Promise<Note | null> {
    const row = await this.db.getFirstAsync<NoteRow>(
      'SELECT * FROM notes WHERE id = ?',
      [id],
    );
    if (!row) return null;
    return this.decryptRow(row);
  }

  async findAll(): Promise<Note[]> {
    const rows = await this.db.getAllAsync<NoteRow>(
      'SELECT * FROM notes ORDER BY updated_at DESC',
    );
    const notes: Note[] = [];
    for (const row of rows) {
      const note = this.decryptRow(row);
      if (note) notes.push(note);
    }
    return notes;
  }

  async update(note: Note): Promise<void> {
    const envelope = this.encryptNote(note);
    await this.db.runAsync(
      'UPDATE notes SET envelope = ?, updated_at = ? WHERE id = ?',
      [envelope, note.updatedAt, note.id],
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
  }

  // --- private ---

  private encryptNote(note: Note): string {
    const json = JSON.stringify(note);
    const envelope = encrypt(this.key, toUtf8(json));
    return toBase64url(envelope);
  }

  private decryptRow(row: NoteRow): Note | null {
    const result = decrypt(this.key, fromBase64url(row.envelope));
    if (!result.ok) {
      logger.warn('NotesRepository: decryption failed for a note');
      return null;
    }
    try {
      const parsed = JSON.parse(fromUtf8(result.value)) as unknown;
      if (!isValidNoteShape(parsed)) {
        logger.warn('NotesRepository: invalid note shape after decryption');
        return null;
      }
      const note = parsed as Note;
      if (!note.attachments) note.attachments = [];
      return note;
    } catch {
      logger.warn('NotesRepository: JSON parse failed after decryption');
      return null;
    }
  }
}
