import { cascadeComplete } from '../providerCascade';
import type { AiProvider } from '../providers/types';

function makeProvider(id: string, response: string | Error): AiProvider {
  return {
    id,
    complete: jest.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    }),
  };
}

describe('cascadeComplete', () => {
  it('returns Err when providers list is empty', async () => {
    const r = await cascadeComplete([], 'prompt');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('No AI providers');
  });

  it('returns Ok with the first provider response on success', async () => {
    const r = await cascadeComplete([makeProvider('p1', 'hello')], 'prompt');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('hello');
  });

  it('falls back to second provider when first throws', async () => {
    const p1 = makeProvider('p1', new Error('offline'));
    const p2 = makeProvider('p2', 'from p2');
    const r = await cascadeComplete([p1, p2], 'prompt');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('from p2');
    expect(p1.complete).toHaveBeenCalledTimes(1);
    expect(p2.complete).toHaveBeenCalledTimes(1);
  });

  it('returns Err with combined message when all providers fail', async () => {
    const p1 = makeProvider('p1', new Error('err1'));
    const p2 = makeProvider('p2', new Error('err2'));
    const r = await cascadeComplete([p1, p2], 'prompt');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toContain('p1');
      expect(r.error.message).toContain('err1');
      expect(r.error.message).toContain('p2');
      expect(r.error.message).toContain('err2');
    }
  });

  it('passes the prompt unchanged to each provider', async () => {
    const p1 = makeProvider('p1', new Error('fail'));
    const p2 = makeProvider('p2', 'ok');
    await cascadeComplete([p1, p2], 'my prompt');
    expect(p1.complete).toHaveBeenCalledWith('my prompt');
    expect(p2.complete).toHaveBeenCalledWith('my prompt');
  });

  it('stops at first success without calling remaining providers', async () => {
    const p1 = makeProvider('p1', 'success');
    const p2 = makeProvider('p2', 'never reached');
    await cascadeComplete([p1, p2], 'prompt');
    expect(p1.complete).toHaveBeenCalledTimes(1);
    expect(p2.complete).not.toHaveBeenCalled();
  });
});
