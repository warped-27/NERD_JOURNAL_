// --- base64url (RFC 4648 §5, no padding) ---

export function toBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function fromBase64url(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? 0 : 4 - (padded.length % 4);
  const binary = atob(padded + '='.repeat(pad));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// --- hex ---

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error(`fromHex: odd-length string (${hex.length})`);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// --- utf8 ---

const enc = new TextEncoder();
const dec = new TextDecoder();

export const toUtf8   = (s: string):    Uint8Array => enc.encode(s);
export const fromUtf8 = (b: Uint8Array): string    => dec.decode(b);
