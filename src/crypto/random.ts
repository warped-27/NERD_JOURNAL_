export function getRandomBytes(length: number): Uint8Array {
  if (length <= 0) throw new RangeError(`getRandomBytes: length must be > 0, got ${length}`);
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return buf;
}
