import { callGemini } from '../geminiService';

const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

function mockOk(text: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  });
}

function mockApiError(message: string, status = 400) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: { message, code: status } }),
  });
}

function mockNetworkError() {
  mockFetch.mockRejectedValueOnce(new Error('Network error'));
}

describe('callGemini', () => {
  beforeEach(() => mockFetch.mockClear());

  it('returns ok with trimmed text on success', async () => {
    mockOk('  Hello world  ');
    const result = await callGemini({ prompt: 'test', apiKey: 'key123' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('Hello world');
  });

  it('sends API key in x-goog-api-key header (not in URL or body)', async () => {
    mockOk('response');
    await callGemini({ prompt: 'test', apiKey: 'MY_KEY' });
    const url     = mockFetch.mock.calls[0][0] as string;
    const options = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(url).not.toContain('MY_KEY');
    expect(headers['x-goog-api-key']).toBe('MY_KEY');
    const body = JSON.parse(options.body as string);
    expect(JSON.stringify(body)).not.toContain('MY_KEY');
  });

  it('returns err on API error response', async () => {
    mockApiError('API key invalid', 400);
    const result = await callGemini({ prompt: 'test', apiKey: 'bad' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('API key invalid');
  });

  it('returns err on network failure', async () => {
    mockNetworkError();
    const result = await callGemini({ prompt: 'test', apiKey: 'key' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Network error');
  });

  it('returns err on empty candidates', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [] }),
    });
    const result = await callGemini({ prompt: 'test', apiKey: 'key' });
    expect(result.ok).toBe(false);
  });

  it('sends correct generationConfig defaults', async () => {
    mockOk('ok');
    await callGemini({ prompt: 'test', apiKey: 'k' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.generationConfig.maxOutputTokens).toBe(1024);
    expect(body.generationConfig.temperature).toBe(0.7);
  });
});
