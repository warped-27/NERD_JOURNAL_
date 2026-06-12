import { assertSafeUrl } from '../../lib/urlValidation';

const TIMEOUT_TRANSCRIBE_MS = 60_000;
const TIMEOUT_TEST_MS       = 10_000;
const REDIRECT_CODES        = new Set([301, 302, 303, 307, 308]);

function mimeToExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('ogg'))  return 'ogg';
  if (mimeType.includes('wav'))  return 'wav';
  return 'm4a'; // mp4 / m4a / fallback
}

export async function testWhisperServerConnection(baseUrl: string): Promise<void> {
  assertSafeUrl(baseUrl);
  const base = baseUrl.replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_TEST_MS);
  let response: Response;
  try {
    response = await fetch(`${base}/v1/models`, {
      redirect: 'manual',
      signal:   controller.signal,
    });
    if (response.type === 'opaqueredirect' || REDIRECT_CODES.has(response.status)) {
      throw new Error('Unexpected redirect — check base URL');
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Whisper server did not respond within 10s');
    }
    if (e instanceof Error && !e.message.includes('redirect')) {
      throw new Error(`Cannot reach server: ${e.message}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok && response.status !== 401) {
    throw new Error(`Whisper server returned HTTP ${response.status}`);
  }
}

/** POST audio to a local Whisper-compatible /v1/audio/transcriptions endpoint. */
export async function transcribeWithWhisperServer(
  baseUrl:   string,
  base64:    string,
  mimeType:  string,
): Promise<string> {
  assertSafeUrl(baseUrl);
  const base = baseUrl.replace(/\/+$/, '');
  const ext  = mimeToExtension(mimeType);

  // base64 → Blob (no atob in some environments — use Buffer fallback)
  let blob: Blob;
  try {
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: mimeType });
  } catch {
    blob = new Blob([Buffer.from(base64, 'base64')], { type: mimeType });
  }

  const form = new FormData();
  form.append('file',            blob, `audio.${ext}`);
  form.append('model',           'whisper-1');
  form.append('response_format', 'text');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_TRANSCRIBE_MS);
  let response: Response;
  try {
    response = await fetch(`${base}/v1/audio/transcriptions`, {
      method:   'POST',
      redirect: 'manual',
      signal:   controller.signal,
      body:     form,
    });
    if (response.type === 'opaqueredirect' || REDIRECT_CODES.has(response.status)) {
      throw new Error('Unexpected redirect from Whisper server');
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Transcription timed out after 60s');
    }
    if (e instanceof Error && !e.message.includes('redirect')) {
      throw new Error(`Whisper server error: ${e.message}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Whisper server returned HTTP ${response.status}`);
  }
  const text = await response.text();
  if (!text.trim()) throw new Error('Whisper server returned empty transcription');
  return text.trim();
}
