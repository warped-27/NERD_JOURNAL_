// Fallback per TextEncoder/TextDecoder in ambienti nativi sprovvisti
class TextEncoderFallback {
  encode(str: string): Uint8Array {
    const utf8 = [];
    for (let i = 0; i < str.length; i++) {
      let charcode = str.charCodeAt(i);
      if (charcode < 0x80) utf8.push(charcode);
      else if (charcode < 0x800) {
        utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
      } else if (charcode < 0xd800 || charcode >= 0xe000) {
        utf8.push(
          0xe0 | (charcode >> 12),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f)
        );
      } else {
        i++;
        charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        utf8.push(
          0xf0 | (charcode >> 18),
          0x80 | ((charcode >> 12) & 0x3f),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f)
        );
      }
    }
    return new Uint8Array(utf8);
  }
}

class TextDecoderFallback {
  decode(bytes: Uint8Array): string {
    let out = "", i = 0;
    const len = bytes.length;
    while (i < len) {
      const c = bytes[i++];
      if (c < 0x80) {
        out += String.fromCharCode(c);
      } else if (c < 0xe0) {
        const c2 = bytes[i++];
        out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
      } else if (c < 0xf0) {
        const c2 = bytes[i++];
        const c3 = bytes[i++];
        out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
      } else {
        const c2 = bytes[i++];
        const c3 = bytes[i++];
        const c4 = bytes[i++];
        const u = (((c & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f)) - 0x10000;
        out += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
      }
    }
    return out;
  }
}

const Encoder = typeof TextEncoder !== 'undefined' ? TextEncoder : TextEncoderFallback;
const Decoder = typeof TextDecoder !== 'undefined' ? TextDecoder : TextDecoderFallback;

// Tabella caratteri Base64
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  const l = bytes.length;
  for (let i = 2; i < l; i += 3) {
    result += chars[bytes[i - 2] >> 2];
    result += chars[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
    result += chars[((bytes[i - 1] & 0x0f) << 2) | (bytes[i] >> 6)];
    result += chars[bytes[i] & 0x3f];
  }
  if (l % 3 === 2) {
    result += chars[bytes[l - 2] >> 2];
    result += chars[((bytes[l - 2] & 0x03) << 4) | (bytes[l - 1] >> 4)];
    result += chars[(bytes[l - 1] & 0x0f) << 2];
    result += '=';
  } else if (l % 3 === 1) {
    result += chars[bytes[l - 1] >> 2];
    result += chars[(bytes[l - 1] & 0x03) << 4];
    result += '==';
  }
  return result;
}

function base64ToBytes(str: string): Uint8Array {
  const bufferLength = str.length * 0.75;
  const len = str.length;
  let p = 0;
  if (str[len - 1] === '=') {
    p++;
    if (str[len - 2] === '=') {
      p++;
    }
  }
  const bytes = new Uint8Array(bufferLength - p);
  let idx = 0;
  for (let i = 0; i < len; i += 4) {
    const c1 = chars.indexOf(str[i]);
    const c2 = chars.indexOf(str[i + 1]);
    const c3 = chars.indexOf(str[i + 2]);
    const c4 = chars.indexOf(str[i + 3]);
    
    bytes[idx++] = (c1 << 2) | (c2 >> 4);
    if (c3 !== -1 && idx < bytes.length) {
      bytes[idx++] = ((c2 & 0x0f) << 4) | (c3 >> 2);
    }
    if (c4 !== -1 && idx < bytes.length) {
      bytes[idx++] = ((c3 & 0x03) << 6) | c4;
    }
  }
  return bytes;
}

// Algoritmo SHA-256 in JS puro
function sha256(bytes: Uint8Array): Uint8Array {
  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const k = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  const len = bytes.length;
  const blocksCount = (((len + 8) >> 6) + 1) << 4;
  const w = new Uint32Array(blocksCount);
  for (let i = 0; i < len; i++) {
    w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  w[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
  const bitLen = len * 8;
  w[blocksCount - 2] = Math.floor(bitLen / 0x100000000);
  w[blocksCount - 1] = bitLen & 0xffffffff;

  for (let i = 0; i < blocksCount; i += 16) {
    const subW = new Uint32Array(64);
    for (let t = 0; t < 16; t++) subW[t] = w[i + t];
    for (let t = 16; t < 64; t++) {
      const s0 = (rightRotate(subW[t - 15], 7) ^ rightRotate(subW[t - 15], 18) ^ (subW[t - 15] >>> 3));
      const s1 = (rightRotate(subW[t - 2], 17) ^ rightRotate(subW[t - 2], 19) ^ (subW[t - 2] >>> 10));
      subW[t] = (subW[t - 16] + s0 + subW[t - 7] + s1) & 0xffffffff;
    }

    let a = hash[0], b = hash[1], c = hash[2], d = hash[3], e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    for (let t = 0; t < 64; t++) {
      const S1 = (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[t] + subW[t]) & 0xffffffff;
      const S0 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) & 0xffffffff;

      h = g; g = f; f = e;
      e = (d + temp1) & 0xffffffff;
      d = c; c = b; b = a;
      a = (temp1 + temp2) & 0xffffffff;
    }

    hash[0] = (hash[0] + a) & 0xffffffff;
    hash[1] = (hash[1] + b) & 0xffffffff;
    hash[2] = (hash[2] + c) & 0xffffffff;
    hash[3] = (hash[3] + d) & 0xffffffff;
    hash[4] = (hash[4] + e) & 0xffffffff;
    hash[5] = (hash[5] + f) & 0xffffffff;
    hash[6] = (hash[6] + g) & 0xffffffff;
    hash[7] = (hash[7] + h) & 0xffffffff;
  }

  const result = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    result[i * 4] = (hash[i] >>> 24) & 0xff;
    result[i * 4 + 1] = (hash[i] >>> 16) & 0xff;
    result[i * 4 + 2] = (hash[i] >>> 8) & 0xff;
    result[i * 4 + 3] = hash[i] & 0xff;
  }
  return result;
}

function rightRotate(v: number, n: number): number {
  return (v >>> n) | (v << (32 - n));
}

// HMAC-SHA256 in JS puro
function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  let paddedKey = key;
  if (key.length > 64) {
    paddedKey = sha256(key);
  }
  if (paddedKey.length < 64) {
    const temp = new Uint8Array(64);
    temp.set(paddedKey);
    paddedKey = temp;
  }

  const oKeyPad = new Uint8Array(64);
  const iKeyPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  const innerMsg = new Uint8Array(64 + message.length);
  innerMsg.set(iKeyPad);
  innerMsg.set(message, 64);
  const innerHash = sha256(innerMsg);

  const outerMsg = new Uint8Array(64 + innerHash.length);
  outerMsg.set(oKeyPad);
  outerMsg.set(innerHash, 64);
  return sha256(outerMsg);
}

// PBKDF2 in JS puro
function pbkdf2HmacSha256(passwordBytes: Uint8Array, salt: Uint8Array, iterations: number, keyLen: number): Uint8Array {
  const derivedKey = new Uint8Array(keyLen);
  let blockIndex = 1;
  let offset = 0;

  while (offset < keyLen) {
    const blockIndexBytes = new Uint8Array(4);
    blockIndexBytes[0] = (blockIndex >>> 24) & 0xff;
    blockIndexBytes[1] = (blockIndex >>> 16) & 0xff;
    blockIndexBytes[2] = (blockIndex >>> 8) & 0xff;
    blockIndexBytes[3] = blockIndex & 0xff;

    const saltWithIndex = new Uint8Array(salt.length + 4);
    saltWithIndex.set(salt);
    saltWithIndex.set(blockIndexBytes, salt.length);

    let u = hmacSha256(passwordBytes, saltWithIndex);
    const t = new Uint8Array(u);

    for (let i = 1; i < iterations; i++) {
      u = hmacSha256(passwordBytes, u);
      for (let j = 0; j < t.length; j++) {
        t[j] ^= u[j];
      }
    }

    const chunkLen = Math.min(32, keyLen - offset);
    derivedKey.set(t.subarray(0, chunkLen), offset);
    offset += chunkLen;
    blockIndex++;
  }

  return derivedKey;
}

// Motore principale CryptoEngine
export const CryptoEngine = {
  /**
   * Deriva una chiave crittografica a partire dalla Master Password.
   * Ritorna una stringa esadecimale (o Uint8Array a seconda dell'uso) rappresentante la chiave a 256 bit.
   */
  async deriveKey(password: string, saltHexOrText?: string): Promise<Uint8Array> {
    const encoder = new Encoder();
    const passwordBytes = encoder.encode(password);
    
    // Salt fisso locale a scopi deterministici o randomizzato.
    // In un diario, usiamo un salt costante generato sul client all'inizializzazione del database.
    const salt = saltHexOrText 
      ? base64ToBytes(saltHexOrText) 
      : encoder.encode('nerd_journal_secure_salt_fixed_constant_pbkdf2');
      
    // PBKDF2 con 10.000 iterazioni per bilanciare ottime performance su mobile e alta sicurezza contro brute-force
    return pbkdf2HmacSha256(passwordBytes, salt, 10000, 32); // 32 byte = 256 bit
  },

  /**
   * Cifra un testo in modo Zero-Knowledge usando SHA256-CTR (Stream Cipher)
   * performante, leggero ed esente da librerie esterne.
   */
  async encryptNote(text: string, keyBytes: Uint8Array): Promise<{ ciphertext: string; iv: string }> {
    const encoder = new Encoder();
    const msgBytes = encoder.encode(text);
    
    // Generazione dell'IV (16 byte)
    const ivBytes = new Uint8Array(16);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(ivBytes);
    } else {
      for (let i = 0; i < 16; i++) {
        ivBytes[i] = Math.floor(Math.random() * 256);
      }
    }

    const encryptedBytes = new Uint8Array(msgBytes.length);
    const blockCount = Math.ceil(msgBytes.length / 32);

    for (let b = 0; b < blockCount; b++) {
      // Keystream block = sha256(keyBytes + ivBytes + index)
      const input = new Uint8Array(keyBytes.length + ivBytes.length + 4);
      input.set(keyBytes);
      input.set(ivBytes, keyBytes.length);
      
      input[keyBytes.length + ivBytes.length] = (b >>> 24) & 0xff;
      input[keyBytes.length + ivBytes.length + 1] = (b >>> 16) & 0xff;
      input[keyBytes.length + ivBytes.length + 2] = (b >>> 8) & 0xff;
      input[keyBytes.length + ivBytes.length + 3] = b & 0xff;

      const keyStream = sha256(input);
      const start = b * 32;
      const end = Math.min(start + 32, msgBytes.length);
      for (let i = start; i < end; i++) {
        encryptedBytes[i] = msgBytes[i] ^ keyStream[i - start];
      }
    }

    return {
      ciphertext: bytesToBase64(encryptedBytes),
      iv: bytesToBase64(ivBytes)
    };
  },

  /**
   * Decifra una nota cifrata.
   */
  async decryptNote(ciphertext: string, iv: string, keyBytes: Uint8Array): Promise<string> {
    const ivBytes = base64ToBytes(iv);
    const encryptedBytes = base64ToBytes(ciphertext);
    const decryptedBytes = new Uint8Array(encryptedBytes.length);
    const blockCount = Math.ceil(encryptedBytes.length / 32);

    for (let b = 0; b < blockCount; b++) {
      const input = new Uint8Array(keyBytes.length + ivBytes.length + 4);
      input.set(keyBytes);
      input.set(ivBytes, keyBytes.length);

      input[keyBytes.length + ivBytes.length] = (b >>> 24) & 0xff;
      input[keyBytes.length + ivBytes.length + 1] = (b >>> 16) & 0xff;
      input[keyBytes.length + ivBytes.length + 2] = (b >>> 8) & 0xff;
      input[keyBytes.length + ivBytes.length + 3] = b & 0xff;

      const keyStream = sha256(input);
      const start = b * 32;
      const end = Math.min(start + 32, encryptedBytes.length);
      for (let i = start; i < end; i++) {
        decryptedBytes[i] = encryptedBytes[i] ^ keyStream[i - start];
      }
    }

    const decoder = new Decoder();
    return decoder.decode(decryptedBytes);
  }
};
