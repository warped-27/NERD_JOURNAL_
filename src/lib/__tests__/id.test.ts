import { newId } from '../id';

describe('newId', () => {
  it('produces a non-empty string', () => {
    expect(newId().length).toBeGreaterThan(0);
  });

  it('is URL-safe (no +, /, =)', () => {
    for (let i = 0; i < 50; i++) {
      const id = newId();
      expect(id).not.toMatch(/[+/=]/);
    }
  });

  it('two calls produce different ids', () => {
    expect(newId()).not.toBe(newId());
  });

  it('respects byteLength', () => {
    // 16 bytes → ceil(16*4/3) = 22 chars (URL-safe base64 without padding)
    expect(newId(16).length).toBe(22);
    expect(newId(8).length).toBe(11);
  });
});
