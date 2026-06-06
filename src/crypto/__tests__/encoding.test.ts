import { toBase64url, fromBase64url, toHex, fromHex, toUtf8, fromUtf8 } from '../encoding';

const BYTES = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff]);

describe('base64url', () => {
  it('encodes to URL-safe base64 (no +, /, =)', () => {
    const s = toBase64url(BYTES);
    expect(s).not.toMatch(/[+/=]/);
  });

  it('round-trips correctly', () => {
    expect(fromBase64url(toBase64url(BYTES))).toEqual(BYTES);
  });

  it('empty array round-trips', () => {
    expect(fromBase64url(toBase64url(new Uint8Array(0)))).toEqual(new Uint8Array(0));
  });
});

describe('hex', () => {
  it('encodes to lowercase hex', () => {
    expect(toHex(BYTES)).toBe('deadbeef00ff');
  });

  it('round-trips correctly', () => {
    expect(fromHex(toHex(BYTES))).toEqual(BYTES);
  });

  it('throws on odd-length hex string', () => {
    expect(() => fromHex('abc')).toThrow();
  });
});

describe('utf8', () => {
  it('encodes string to bytes', () => {
    const s = 'ciao 🌍';
    expect(fromUtf8(toUtf8(s))).toBe(s);
  });

  it('handles empty string', () => {
    expect(toUtf8('')).toEqual(new Uint8Array(0));
    expect(fromUtf8(new Uint8Array(0))).toBe('');
  });
});
