import {
  webdavPush, webdavPull, webdavPushBlob, webdavPullBlob,
  testWebDavConnection, type WebDavConfig,
} from '../providers/webdavSync';
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
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201, headers: { get: () => null } });
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

  it('returns parsed bundle and etag on 200', async () => {
    const json = JSON.stringify(bundle);
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => json,
      headers: { get: (h: string) => h === 'ETag' ? '"abc123"' : null },
    });
    const result = await webdavPull(cfg);
    expect(result).not.toBeNull();
    expect(result?.bundle.version).toBe(1);
    expect(result?.bundle.salt).toBe('AAAA');
    expect(result?.etag).toBe('"abc123"');
  });

  it('returns etag: null when server omits ETag header', async () => {
    const json = JSON.stringify(bundle);
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => json,
      headers: { get: () => null },
    });
    const result = await webdavPull(cfg);
    expect(result?.etag).toBeNull();
  });

  it('returns null on 304 (not modified)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 304 });
    const result = await webdavPull(cfg, '"prev-etag"');
    expect(result).toBeNull();
  });

  it('sends If-None-Match header when etag is provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 304 });
    await webdavPull(cfg, '"etag-abc"');
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['If-None-Match']).toBe('"etag-abc"');
  });

  it('does not send If-None-Match when etag is absent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(bundle),
      headers: { get: () => null },
    });
    await webdavPull(cfg);
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['If-None-Match']).toBeUndefined();
  });

  it('throws on non-ok non-304/404 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });
    await expect(webdavPull(cfg)).rejects.toThrow('401');
  });
});

describe('webdavPushBlob', () => {
  it('attempts MKCOL then PUT to blob URL', async () => {
    // MKCOL response (ignored)
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201 });
    // PUT response
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201 });

    await webdavPushBlob(cfg, 'attach-001', 'base64envelope==');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [putUrl, putOpts] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(putUrl).toContain('nerd_journal_blobs/attach-001.njblob');
    expect((putOpts.headers as Record<string, string>)['Content-Type']).toBe('application/octet-stream');
    expect(putOpts.body).toBe('base64envelope==');
  });

  it('throws when PUT fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });                         // MKCOL
    mockFetch.mockResolvedValueOnce({ ok: false, status: 507, statusText: 'Insufficient Storage' });
    await expect(webdavPushBlob(cfg, 'x', 'data')).rejects.toThrow('507');
  });
});

describe('webdavPullBlob', () => {
  it('returns null on 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await webdavPullBlob(cfg, 'missing-blob');
    expect(result).toBeNull();
  });

  it('returns envelope text on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'envelope-data==' });
    const result = await webdavPullBlob(cfg, 'blob-001');
    expect(result).toBe('envelope-data==');
  });

  it('requests correct blob URL', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => '' });
    await webdavPullBlob(cfg, 'my-blob');
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('nerd_journal_blobs/my-blob.njblob');
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

describe('URL validation', () => {
  const httpLanCfg: WebDavConfig = { url: 'http://192.168.1.50/dav', username: 'u', password: 'p' };
  const fileCfg:    WebDavConfig = { url: 'file:///etc/passwd',       username: 'u', password: 'p' };

  it('webdavPush throws for http:// on non-localhost', async () => {
    await expect(webdavPush(httpLanCfg, bundle)).rejects.toThrow('Unencrypted HTTP');
  });

  it('webdavPull throws for http:// on non-localhost', async () => {
    await expect(webdavPull(httpLanCfg)).rejects.toThrow('Unencrypted HTTP');
  });

  it('testWebDavConnection throws for file:// scheme', async () => {
    await expect(testWebDavConnection(fileCfg)).rejects.toThrow('not allowed');
  });

  it('accepts https:// for external hosts', async () => {
    mockFetch.mockResolvedValueOnce({ status: 207 });
    await expect(testWebDavConnection(cfg)).resolves.not.toThrow();
  });
});
