import { askAi } from '../aiService';
import { DEFAULT_RATE_LIMITER } from '../rateLimiter';
import type { AiProvider } from '../providers/types';
import { ok, err } from '../../lib/result';

function makeProvider(response: string | Error): AiProvider {
  return {
    id:           'test',
    displayName:  'Test',
    privacyLevel: 'cloud',
    complete: jest.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    }),
  };
}

describe('askAi', () => {
  beforeEach(() => DEFAULT_RATE_LIMITER.reset());

  it('returns err when no providers', async () => {
    const r = await askAi({ noteContent: 'note', instruction: 'summarize', providers: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('No AI providers');
  });

  it('returns err when instruction is empty after sanitize', async () => {
    const r = await askAi({ noteContent: 'note', instruction: '\x00\x01', providers: [makeProvider('ok')] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('empty');
  });

  it('calls provider with sanitized content', async () => {
    const provider = makeProvider('summary');
    await askAi({ noteContent: 'Hello\x00world', instruction: 'summarize', providers: [provider] });
    const prompt = (provider.complete as jest.Mock).mock.calls[0]![0] as string;
    expect(prompt).not.toContain('\x00');
  });

  it('returns provider response on success', async () => {
    const r = await askAi({ noteContent: 'note', instruction: 'summarize', providers: [makeProvider('AI response')] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('AI response');
  });

  it('returns err when rate limit exceeded', async () => {
    const limiter = DEFAULT_RATE_LIMITER as any;
    limiter.opts = { maxRequests: 1, windowMs: 60_000 };
    await askAi({ noteContent: 'n', instruction: 'i', providers: [makeProvider('ok')] });
    const r = await askAi({ noteContent: 'n', instruction: 'i', providers: [makeProvider('ok')] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('Rate limit');
    limiter.opts = { maxRequests: 10, windowMs: 60_000 };
  });

  it('falls back to second provider when first throws', async () => {
    const p1 = makeProvider(new Error('offline'));
    const p2 = makeProvider('fallback');
    const r = await askAi({ noteContent: 'note', instruction: 'summarize', providers: [p1, p2] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('fallback');
  });

  it('returns err when all providers fail', async () => {
    const p1 = makeProvider(new Error('fail1'));
    const p2 = makeProvider(new Error('fail2'));
    const r = await askAi({ noteContent: 'note', instruction: 'summarize', providers: [p1, p2] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('AI request failed');
  });
});
