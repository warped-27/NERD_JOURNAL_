import { ok, err, unwrap } from '../result';

describe('result', () => {
  it('ok wraps a value', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it('err wraps an error', () => {
    const r = err('boom');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('boom');
  });

  it('unwrap returns value on Ok', () => {
    expect(unwrap(ok('hello'))).toBe('hello');
  });

  it('unwrap throws on Err', () => {
    expect(() => unwrap(err('fail'))).toThrow('fail');
  });
});
