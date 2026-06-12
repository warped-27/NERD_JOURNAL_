import {
  testWhisperServerConnection,
  transcribeWithWhisperServer,
} from '../whisperServerClient';

const mockFetch = jest.fn();
global.fetch = mockFetch;

// btoa / atob are available in jsdom
global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

beforeEach(() => {
  jest.clearAllMocks();
});

// ── testWhisperServerConnection ──────────────────────────────────────────────

describe('testWhisperServerConnection', () => {
  it('resolves when server returns 200', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, type: 'basic' });
    await expect(testWhisperServerConnection('http://localhost:8000')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/v1/models',
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('resolves when server returns 401 (auth required but reachable)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, type: 'basic' });
    await expect(testWhisperServerConnection('http://localhost:8000')).resolves.toBeUndefined();
  });

  it('throws on HTTP 500', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, type: 'basic' });
    await expect(testWhisperServerConnection('http://localhost:8000'))
      .rejects.toThrow('HTTP 500');
  });

  it('throws on redirect', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 301, type: 'basic' });
    await expect(testWhisperServerConnection('http://localhost:8000'))
      .rejects.toThrow('redirect');
  });

  it('throws on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(testWhisperServerConnection('http://localhost:8000'))
      .rejects.toThrow('Cannot reach server');
  });

  it('rejects non-localhost URLs (SSRF guard)', async () => {
    await expect(testWhisperServerConnection('http://169.254.169.254:8000'))
      .rejects.toThrow();
  });
});

// ── transcribeWithWhisperServer ──────────────────────────────────────────────

describe('transcribeWithWhisperServer', () => {
  const DUMMY_B64 = Buffer.from('fake-audio-data').toString('base64');

  it('returns trimmed transcription text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200, type: 'basic',
      text: async () => '  Hello world.  ',
    });
    const result = await transcribeWithWhisperServer(
      'http://localhost:8000', DUMMY_B64, 'audio/webm',
    );
    expect(result).toBe('Hello world.');
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('http://localhost:8000/v1/audio/transcriptions');
    expect(call[1].method).toBe('POST');
  });

  it('uses correct extension for webm', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, type: 'basic', text: async () => 'ok' });
    await transcribeWithWhisperServer('http://localhost:8000', DUMMY_B64, 'audio/webm');
    const body: FormData = mockFetch.mock.calls[0][1].body;
    const file = body.get('file') as File;
    expect(file.name).toBe('audio.webm');
  });

  it('uses m4a extension for audio/mp4', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, type: 'basic', text: async () => 'ok' });
    await transcribeWithWhisperServer('http://localhost:8000', DUMMY_B64, 'audio/mp4');
    const body: FormData = mockFetch.mock.calls[0][1].body;
    const file = body.get('file') as File;
    expect(file.name).toBe('audio.m4a');
  });

  it('throws on empty transcription', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, type: 'basic', text: async () => '   ' });
    await expect(
      transcribeWithWhisperServer('http://localhost:8000', DUMMY_B64, 'audio/webm'),
    ).rejects.toThrow('empty transcription');
  });

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422, type: 'basic', text: async () => '' });
    await expect(
      transcribeWithWhisperServer('http://localhost:8000', DUMMY_B64, 'audio/webm'),
    ).rejects.toThrow('HTTP 422');
  });

  it('throws on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fetch failed'));
    await expect(
      transcribeWithWhisperServer('http://localhost:8000', DUMMY_B64, 'audio/webm'),
    ).rejects.toThrow('Whisper server error');
  });
});
