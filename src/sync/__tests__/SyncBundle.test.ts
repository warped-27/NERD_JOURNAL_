import { parseBundle, serializeBundle, type SyncBundle } from '../SyncBundle';

const validBundle: SyncBundle = {
  version:    1,
  salt:       'AAAAAAAAAAAAAAAAAAAAAA',
  notes:      [],
  exportedAt: 1700000000000,
  deviceId:   'dev-1',
};

describe('SyncBundle', () => {
  it('round-trips correctly', () => {
    const json   = serializeBundle(validBundle);
    const parsed = parseBundle(json);
    expect(parsed.version).toBe(1);
    expect(parsed.salt).toBe(validBundle.salt);
    expect(parsed.exportedAt).toBe(validBundle.exportedAt);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseBundle('not json')).toThrow();
  });

  it('throws when version is wrong', () => {
    const broken = JSON.stringify({ ...validBundle, version: 2 });
    expect(() => parseBundle(broken)).toThrow('Invalid sync bundle format');
  });

  it('throws when salt is missing', () => {
    const { salt: _s, ...noSalt } = validBundle;
    expect(() => parseBundle(JSON.stringify(noSalt))).toThrow('Invalid sync bundle format');
  });

  it('throws when notes is not an array', () => {
    const broken = JSON.stringify({ ...validBundle, notes: 'bad' });
    expect(() => parseBundle(broken)).toThrow('Invalid sync bundle format');
  });

  it('throws when exportedAt is missing', () => {
    const { exportedAt: _e, ...noTs } = validBundle;
    expect(() => parseBundle(JSON.stringify(noTs))).toThrow('Invalid sync bundle format');
  });

  it('preserves note rows inside bundle', () => {
    const bundleWithNotes: SyncBundle = {
      ...validBundle,
      notes: [{ id: 'n1', envelope: 'abc', updated_at: 1, created_at: 0 }],
    };
    const parsed = parseBundle(serializeBundle(bundleWithNotes));
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.notes[0]!.id).toBe('n1');
  });
});
