import { makeOpenAiCompatProvider, testOpenAiCompatConnection } from '../providers/openAiCompatProvider';

const BASE = 'http://localhost:11434';

function mockFetch(status: number, body: unknown) {
  (globalThis as any).fetch = jest.fn().mockResolvedValue({
    ok:   status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('makeOpenAiCompatProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns text from choices[0].message.content', async () => {
    mockFetch(200, { choices: [{ message: { content: '  hello  ' } }] });
    const provider = makeOpenAiCompatProvider({ id: 'ollama', baseUrl: BASE, model: 'llama3.2:3b' });
    expect(await provider.complete('prompt')).toBe('hello');
  });

  it('sends correct request body', async () => {
    mockFetch(200, { choices: [{ message: { content: 'ok' } }] });
    const provider = makeOpenAiCompatProvider({ id: 'ollama', baseUrl: BASE, model: 'llama3.2:3b' });
    await provider.complete('test prompt');
    const call = (fetch as jest.Mock).mock.calls[0]!;
    const body = JSON.parse(call[1].body as string);
    expect(body.model).toBe('llama3.2:3b');
    expect(body.messages[0].content).toBe('test prompt');
    expect(body.stream).toBe(false);
  });

  it('adds Authorization header when apiKey is provided', async () => {
    mockFetch(200, { choices: [{ message: { content: 'ok' } }] });
    const provider = makeOpenAiCompatProvider({ id: 'ollama', baseUrl: BASE, model: 'm', apiKey: 'tok' });
    await provider.complete('p');
    const headers = (fetch as jest.Mock).mock.calls[0]![1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok');
  });

  it('omits Authorization header when no apiKey', async () => {
    mockFetch(200, { choices: [{ message: { content: 'ok' } }] });
    const provider = makeOpenAiCompatProvider({ id: 'ollama', baseUrl: BASE, model: 'm' });
    await provider.complete('p');
    const headers = (fetch as jest.Mock).mock.calls[0]![1].headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('strips trailing slash from baseUrl', async () => {
    mockFetch(200, { choices: [{ message: { content: 'ok' } }] });
    const provider = makeOpenAiCompatProvider({ id: 'ollama', baseUrl: BASE + '/', model: 'm' });
    await provider.complete('p');
    const url = (fetch as jest.Mock).mock.calls[0]![0] as string;
    expect(url).toBe(`${BASE}/v1/chat/completions`);
  });

  it('throws on non-ok HTTP status', async () => {
    mockFetch(500, { error: { message: 'internal error' } });
    const provider = makeOpenAiCompatProvider({ id: 'ollama', baseUrl: BASE, model: 'm' });
    await expect(provider.complete('p')).rejects.toThrow('internal error');
  });

  it('throws when choices array is empty', async () => {
    mockFetch(200, { choices: [] });
    const provider = makeOpenAiCompatProvider({ id: 'ollama', baseUrl: BASE, model: 'm' });
    await expect(provider.complete('p')).rejects.toThrow('empty response');
  });

  it('throws on network error', async () => {
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const provider = makeOpenAiCompatProvider({ id: 'ollama', baseUrl: BASE, model: 'm' });
    await expect(provider.complete('p')).rejects.toThrow('network error');
  });
});

describe('testOpenAiCompatConnection', () => {
  afterEach(() => jest.restoreAllMocks());

  it('resolves when server returns 200', async () => {
    mockFetch(200, { data: [] });
    await expect(testOpenAiCompatConnection(BASE)).resolves.toBeUndefined();
  });

  it('throws when server returns non-ok status', async () => {
    mockFetch(404, {});
    await expect(testOpenAiCompatConnection(BASE)).rejects.toThrow('HTTP 404');
  });

  it('throws on network error', async () => {
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(testOpenAiCompatConnection(BASE)).rejects.toThrow('Cannot reach server');
  });
});
