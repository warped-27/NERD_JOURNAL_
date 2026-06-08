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
  };
}

export interface MergeResult {
  imported: number;
  skipped:  number;
}

function isValidRow(r: unknown): r is NoteRow {
  if (typeof r !== 'object' || r === null) return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o['id']         === 'string' && (o['id'] as string).length > 0 &&
    typeof o['envelope']   === 'string' &&
    typeof o['updated_at'] === 'number' &&
    typeof o['created_at'] === 'number'
  );
}

export async function mergeBundle(db: Database, bundle: SyncBundle): Promise<MergeResult> {
  let imported = 0;
  let skipped  = 0;

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

  return { imported, skipped };
}
