import { mergeBundle, needsPush, type MergeResult } from '../syncRepository';
import type { SyncBundle } from '../SyncBundle';

// Mock vaultStorage so loadSalt doesn't hit SecureStore
jest.mock('../../crypto/vaultStorage', () => ({
  loadSalt: jest.fn().mockResolvedValue(new Uint8Array(16)),
}));
jest.mock('../../crypto/secureSecrets', () => ({
  secretGet: jest.fn().mockResolvedValue('test-device'),
  secretSet: jest.fn().mockResolvedValue(undefined),
}));

function makeDb(existingRows: { id: string; updated_at: number }[] = []) {
  const rows = [...existingRows];
  return {
    getAllAsync:   jest.fn().mockResolvedValue(rows),
    getFirstAsync: jest.fn(async (_sql: string, params: unknown[]) => {
      // For needsPush COUNT query: params[0] is the `since` timestamp
      if (_sql.includes('COUNT')) {
        const since = params[0] as number;
        const count = rows.filter((r) => r.updated_at > since).length;
        return { c: count };
      }
      return rows.find((r) => r.id === params[0]) ?? null;
    }),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 }),
    execAsync: jest.fn().mockResolvedValue(undefined),
    withTransactionAsync: jest.fn(async (cb: () => Promise<void>) => { await cb(); }),
  };
}

const baseBundle: SyncBundle = {
  version:    1,
  salt:       'AAAAAAAAAAAAAAAAAAAAAA',
  notes:      [],
  exportedAt: Date.now(),
  deviceId:   'remote-device',
};

describe('mergeBundle', () => {
  it('inserts new notes not present locally', async () => {
    const db = makeDb([]);
    const bundle: SyncBundle = {
      ...baseBundle,
      notes: [{ id: 'n1', envelope: 'env1', updated_at: 100, created_at: 50 }],
    };
    const result: MergeResult = await mergeBundle(db as any, bundle);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT'),
      ['n1', 'env1', 100, 50],
    );
  });

  it('updates existing note if remote is newer', async () => {
    const db = makeDb([{ id: 'n1', updated_at: 50 }]);
    const bundle: SyncBundle = {
      ...baseBundle,
      notes: [{ id: 'n1', envelope: 'newer', updated_at: 200, created_at: 10 }],
    };
    const result = await mergeBundle(db as any, bundle);
    expect(result.imported).toBe(1);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE'),
      ['newer', 200, 'n1'],
    );
  });

  it('skips note if local is newer or equal', async () => {
    const db = makeDb([{ id: 'n1', updated_at: 300 }]);
    const bundle: SyncBundle = {
      ...baseBundle,
      notes: [{ id: 'n1', envelope: 'old', updated_at: 100, created_at: 10 }],
    };
    const result = await mergeBundle(db as any, bundle);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('skips malformed rows', async () => {
    const db = makeDb([]);
    const bundle = { ...baseBundle, notes: [{ id: '', envelope: 'x', updated_at: 1, created_at: 0 }] };
    const result = await mergeBundle(db as any, bundle as SyncBundle);
    expect(result.skipped).toBe(1);
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('handles empty bundle', async () => {
    const db = makeDb([{ id: 'local', updated_at: 100 }]);
    const result = await mergeBundle(db as any, baseBundle);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
  });
});

describe('needsPush', () => {
  it('returns true when a note is newer than since', async () => {
    const db = makeDb([{ id: 'n1', updated_at: 200 }]);
    expect(await needsPush(db as any, 100)).toBe(true);
  });

  it('returns false when all notes are older than since', async () => {
    const db = makeDb([{ id: 'n1', updated_at: 50 }]);
    expect(await needsPush(db as any, 100)).toBe(false);
  });

  it('returns false for empty db', async () => {
    const db = makeDb([]);
    expect(await needsPush(db as any, 0)).toBe(false);
  });

  it('returns true when note updated_at equals since + 1', async () => {
    const db = makeDb([{ id: 'n1', updated_at: 101 }]);
    expect(await needsPush(db as any, 100)).toBe(true);
  });
});
