import type { Database } from '../db/types';
import type { NoteRow } from '../notes/Note';
import type { SyncBundle } from './SyncBundle';
import { loadSalt } from '../crypto/vaultStorage';
import { toBase64url } from '../crypto/encoding';
import { secretGet, secretSet } from '../crypto/secureSecrets';
import { newId } from '../lib/id';

const DEVICE_ID_KEY = 'nj_device_id';

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await secretGet(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = newId();
  await secretSet(DEVICE_ID_KEY, id);
  return id;
}

export async function exportBundle(db: Database): Promise<SyncBundle> {
  const saltBytes = await loadSalt();
  if (!saltBytes) throw new Error('Vault not initialised — cannot export');

  const rows     = await db.getAllAsync<NoteRow>('SELECT * FROM notes ORDER BY updated_at DESC');
  const deviceId = await getOrCreateDeviceId();

  return {
    version:    1,
    salt:       toBase64url(saltBytes),
    notes:      rows,
    exportedAt: Date.now(),
    deviceId,
    isFull:     true,
  };
}

/** Returns true if any note has been modified after `since` (unix ms). */
export async function needsPush(db: Database, since: number): Promise<boolean> {
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM notes WHERE updated_at > ?',
    [since],
  );
  return (row?.c ?? 0) > 0;
}

export interface MergeResult {
  imported: number;
  skipped:  number;
}

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

function isValidRow(r: unknown): r is NoteRow {
  if (typeof r !== 'object' || r === null) return false;
  const o = r as Record<string, unknown>;
  if (typeof o['id'] !== 'string' || (o['id'] as string).length === 0) return false;
  if (typeof o['updated_at'] !== 'number') return false;
  if (typeof o['created_at'] !== 'number') return false;
  const env = o['envelope'];
  if (typeof env !== 'string') return false;
  // Envelope must be non-empty, within sane size bounds, and valid base64url
  if (env.length === 0 || env.length > 10_000_000) return false;
  if (!BASE64URL_RE.test(env)) return false;
  return true;
}

export async function mergeBundle(db: Database, bundle: SyncBundle): Promise<MergeResult> {
  let imported = 0;
  let skipped  = 0;

  // Wrap all writes in a transaction so a mid-import crash leaves the DB clean.
  await db.withTransactionAsync(async () => {
    for (const row of bundle.notes) {
      if (!isValidRow(row)) { skipped++; continue; }

      const existing = await db.getFirstAsync<{ updated_at: number }>(
        'SELECT updated_at FROM notes WHERE id = ?',
        [row.id],
      );

      if (!existing) {
        await db.runAsync(
          'INSERT INTO notes (id, envelope, updated_at, created_at) VALUES (?, ?, ?, ?)',
          [row.id, row.envelope, row.updated_at, row.created_at],
        );
        imported++;
      } else if (row.updated_at > existing.updated_at) {
        await db.runAsync(
          'UPDATE notes SET envelope = ?, updated_at = ? WHERE id = ?',
          [row.envelope, row.updated_at, row.id],
        );
        imported++;
      } else {
        skipped++;
      }
    }
  });

  return { imported, skipped };
}
