import type { SyncBundle } from '../SyncBundle';
import { serializeBundle, parseBundle } from '../SyncBundle';

export interface WebDavConfig {
  url:      string;   // base URL, e.g. https://cloud.example.com/dav/files/user
  username: string;
  password: string;
}

const BUNDLE_FILENAME = 'nerd_journal_.njvault';

function bundleUrl(config: WebDavConfig): string {
  return `${config.url.replace(/\/+$/, '')}/${BUNDLE_FILENAME}`;
}

function basicAuth(username: string, password: string): string {
  return 'Basic ' + btoa(`${username}:${password}`);
}

export async function webdavPush(config: WebDavConfig, bundle: SyncBundle): Promise<void> {
  const res = await fetch(bundleUrl(config), {
    method:  'PUT',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': basicAuth(config.username, config.password),
    },
    body: serializeBundle(bundle),
  });
  if (!res.ok) throw new Error(`WebDAV PUT failed: ${res.status} ${res.statusText}`);
}

export async function webdavPull(config: WebDavConfig): Promise<SyncBundle | null> {
  const res = await fetch(bundleUrl(config), {
    method:  'GET',
    headers: { 'Authorization': basicAuth(config.username, config.password) },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`WebDAV GET failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  return parseBundle(text);
}

export async function testWebDavConnection(config: WebDavConfig): Promise<void> {
  // PROPFIND on the root to verify credentials and reachability
  const res = await fetch(config.url.replace(/\/+$/, ''), {
    method:  'PROPFIND',
    headers: {
      'Authorization': basicAuth(config.username, config.password),
      'Depth': '0',
    },
  });
  // 207 = Multi-Status (WebDAV success), 200 also acceptable
  if (res.status !== 207 && res.status !== 200) {
    throw new Error(`Connection failed: ${res.status} ${res.statusText}`);
  }
}
