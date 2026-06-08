import { webdavPush, webdavPull, testWebDavConnection, type WebDavConfig } from '../providers/webdavSync';
import type { SyncBundle } from '../SyncBundle';

const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

const cfg: WebDavConfig = { url: 'https://dav.example.com/files/user', username: 'alice', password: 'secret' };

const bundle: SyncBundle = {
  version: 1, salt: 'AAAA', notes: [], exportedAt: 1, deviceId: 'x',
};

beforeEach(() => mockFetch.mockClear());

describe('webdavPush', () => {
  it('sends PUT to correct URL with auth header', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201 });
    await webdavPush(cfg, bundle);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://dav.example.com/files/user/nerd_journal_.njvault');
    expect(options.method).toBe('PUT');
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Basic /);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' });
    await expect(webdavPush(cfg, bundle)).rejects.toThrow('403');
  });
});

describe('webdavPull', () => {
  it('returns null on 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await webdavPull(cfg);
    expect(result).toBeNull();
  });

  it('returns parsed bundle on success', async () => {
    const json = JSON.stringify(bundle);
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => json });
    const result = await webdavPull(cfg);
    expect(result?.version).toBe(1);
    expect(result?.salt).toBe('AAAA');
  });

  it('throws on non-ok non-404 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });
    await expect(webdavPull(cfg)).rejects.toThrow('401');
  });
});

describe('testWebDavConnection', () => {
  it('resolves on 207', async () => {
    mockFetch.mockResolvedValueOnce({ status: 207 });
    await expect(testWebDavConnection(cfg)).resolves.not.toThrow();
  });

  it('throws on unexpected status', async () => {
    mockFetch.mockResolvedValueOnce({ status: 401, statusText: 'Unauthorized' });
    await expect(testWebDavConnection(cfg)).rejects.toThrow('401');
  });
});
