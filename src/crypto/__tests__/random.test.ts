import { getRandomBytes } from '../random';

describe('getRandomBytes', () => {
  it('returns a Uint8Array of the requested length', () => {
    const buf = getRandomBytes(16);
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBe(16);
  });

  it('two calls produce different values', () => {
    const a = getRandomBytes(32);
    const b = getRandomBytes(32);
    expect(a).not.toEqual(b);
  });

  it('output is not all-zero', () => {
    const buf = getRandomBytes(32);
    expect(buf.some((x) => x !== 0)).toBe(true);
  });

  it('throws for length <= 0', () => {
    expect(() => getRandomBytes(0)).toThrow();
    expect(() => getRandomBytes(-1)).toThrow();
  });
});
