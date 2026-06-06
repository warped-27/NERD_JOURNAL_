import { askAi } from '../aiService';
import { DEFAULT_RATE_LIMITER } from '../rateLimiter';
import * as gemini from '../geminiService';
import { ok, err } from '../../lib/result';

jest.mock('../geminiService');
const mockCallGemini = gemini.callGemini as jest.MockedFunction<typeof gemini.callGemini>;

describe('askAi', () => {
  beforeEach(() => {
    DEFAULT_RATE_LIMITER.reset();
    mockCallGemini.mockClear();
  });

  it('returns err when no API key', async () => {
    const r = await askAi({ noteContent: 'note', instruction: 'summarize', apiKey: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('No API key');
  });

  it('returns err when instruction is empty after sanitize', async () => {
    const r = await askAi({ noteContent: 'note', instruction: '\x00\x01', apiKey: 'key' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('empty');
  });

  it('calls Gemini with sanitized content', async () => {
    mockCallGemini.mockResolvedValue(ok('summary'));
    await askAi({
      noteContent: 'Hello\x00world',
      instruction: 'summarize',
      apiKey: 'my-key',
    });
    const call = mockCallGemini.mock.calls[0]![0]!;
    expect(call.prompt).not.toContain('\x00');
    expect(call.apiKey).toBe('my-key');
  });

  it('returns Gemini response on success', async () => {
    mockCallGemini.mockResolvedValue(ok('AI response'));
    const r = await askAi({ noteContent: 'note', instruction: 'summarize', apiKey: 'key' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('AI response');
  });

  it('returns err when rate limit exceeded', async () => {
    mockCallGemini.mockResolvedValue(ok('ok'));
    const limiter = DEFAULT_RATE_LIMITER as any;
    // Fill up the rate limiter
    limiter.opts = { maxRequests: 1, windowMs: 60_000 };
    await askAi({ noteContent: 'n', instruction: 'i', apiKey: 'key' });
    const r = await askAi({ noteContent: 'n', instruction: 'i', apiKey: 'key' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('Rate limit');
    // Restore
    limiter.opts = { maxRequests: 10, windowMs: 60_000 };
  });

  it('propagates Gemini errors', async () => {
    mockCallGemini.mockResolvedValue(err(new Error('API error')));
    const r = await askAi({ noteContent: 'note', instruction: 'summarize', apiKey: 'key' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toBe('API error');
  });
});
