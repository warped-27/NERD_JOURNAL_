import type { SyncBundle } from '../SyncBundle';
import { serializeBundle, parseBundle } from '../SyncBundle';
import { assertSafeUrl } from '../../lib/urlValidation';

export interface S3Config {
  endpoint:  string;  // https://s3.amazonaws.com | https://<id>.r2.cloudflarestorage.com
  region:    string;  // us-east-1 | auto | us-west-004
  bucket:    string;
  accessKey: string;
  secretKey: string;
}

const OBJECT_KEY = 'nerd_journal_.njvault';

// ─── SigV4 helpers ────────────────────────────────────────────────────────────

const enc = new TextEncoder();

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveSigningKey(secretKey: string, date: string, region: string): Promise<ArrayBuffer> {
  let key: ArrayBuffer = enc.encode('AWS4' + secretKey).buffer as ArrayBuffer;
  key = await hmacSha256(key, date);
  key = await hmacSha256(key, region);
  key = await hmacSha256(key, 's3');
  key = await hmacSha256(key, 'aws4_request');
  return key;
}

async function buildAuthHeaders(
  config: S3Config,
  method: string,
  path: string,          // e.g. /bucket/key
  body: string,
  contentType?: string,
): Promise<Record<string, string>> {
  const now     = new Date();
  const amzDate = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z';
  const dateStr = amzDate.slice(0, 8);

  const host         = new URL(config.endpoint).host;
  const payloadHash  = await sha256Hex(body);

  const hdrs: Record<string, string> = {
    'host':                  host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date':            amzDate,
  };
  if (contentType) hdrs['content-type'] = contentType;

  const sortedKeys      = Object.keys(hdrs).sort();
  const canonicalHdrs   = sortedKeys.map(k => `${k}:${hdrs[k]}\n`).join('');
  const signedHdrs      = sortedKeys.join(';');
  const credentialScope = `${dateStr}/${config.region}/s3/aws4_request`;

  const canonicalRequest = [method, path, '', canonicalHdrs, signedHdrs, payloadHash].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await deriveSigningKey(config.secretKey, dateStr, config.region);
  const signature  = toHex(await hmacSha256(signingKey, stringToSign));

  return {
    ...hdrs,
    Authorization: [
      `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}`,
      `SignedHeaders=${signedHdrs}`,
      `Signature=${signature}`,
    ].join(', '),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

function objectUrl(config: S3Config): string {
  return `${config.endpoint.replace(/\/+$/, '')}/${config.bucket}/${OBJECT_KEY}`;
}

function objectPath(config: S3Config): string {
  return `/${config.bucket}/${OBJECT_KEY}`;
}

export async function s3Push(config: S3Config, bundle: SyncBundle): Promise<void> {
  assertSafeUrl(config.endpoint);
  const body    = serializeBundle(bundle);
  const headers = await buildAuthHeaders(config, 'PUT', objectPath(config), body, 'application/json');
  const res = await fetch(objectUrl(config), {
    method:   'PUT',
    redirect: 'manual',
    headers:  { ...headers, 'Content-Type': 'application/json' },
    body,
  });
  if (res.type === 'opaqueredirect' || (res.status >= 301 && res.status <= 308)) {
    throw new Error('S3 PUT: unexpected redirect — check endpoint configuration');
  }
  if (!res.ok) throw new Error(`S3 PUT failed: ${res.status} ${res.statusText}`);
}

export interface S3PullResult {
  bundle: SyncBundle;
  etag:   string | null;
}

export async function s3Pull(config: S3Config, lastEtag?: string | null): Promise<S3PullResult | null> {
  assertSafeUrl(config.endpoint);
  const extraHdrs: Record<string, string> = {};
  if (lastEtag) extraHdrs['If-None-Match'] = lastEtag;

  const authHdrs = await buildAuthHeaders(config, 'GET', objectPath(config), '');
  const res = await fetch(objectUrl(config), {
    method:   'GET',
    redirect: 'manual',
    headers:  { ...authHdrs, ...extraHdrs },
  });
  if (res.type === 'opaqueredirect' || (res.status >= 301 && res.status <= 308)) {
    throw new Error('S3 GET: unexpected redirect — check endpoint configuration');
  }
  if (res.status === 304) return null;
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`S3 GET failed: ${res.status} ${res.statusText}`);
  const text   = await res.text();
  const bundle = parseBundle(text);
  const etag   = res.headers.get('ETag');
  return { bundle, etag };
}

export async function testS3Connection(config: S3Config): Promise<void> {
  assertSafeUrl(config.endpoint);
  const bucketUrl  = `${config.endpoint.replace(/\/+$/, '')}/${config.bucket}`;
  const bucketPath = `/${config.bucket}`;
  const headers = await buildAuthHeaders(config, 'HEAD', bucketPath, '');
  const res = await fetch(bucketUrl, { method: 'HEAD', redirect: 'manual', headers });
  if (res.type === 'opaqueredirect' || (res.status >= 301 && res.status <= 308)) {
    throw new Error('S3 HEAD: unexpected redirect — check endpoint configuration');
  }
  if (!res.ok) throw new Error(`S3 connection failed: ${res.status} ${res.statusText}`);
}
