import { mergeBundle, type MergeResult } from '../syncRepository';
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
    getAllAsync: jest.fn().mockResolvedValue(rows),
    getFirstAsync: jest.fn(async (_sql: string, params: string[]) => {
      return rows.find((r) => r.id === params[0]) ?? null;
    }),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 }),
    execAsync: jest.fn().mockResolvedValue(undefined),
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
