import type { Result } from '../lib/result';
import { ok, err } from '../lib/result';

/** Transcribe audio using local Whisper. Returns err if Whisper is not loaded. */
export async function transcribeAudioWithFallback(
  audioPath:  string,
  _base64Audio: string,
  _mimeType:  string,
  whisperFn:  ((path: string) => Promise<string | null>) | null,
): Promise<Result<string, Error>> {
  if (!whisperFn) {
    return err(new Error('Voice transcription requires the Whisper model. Download it in Settings → Voice.'));
  }
  try {
    const text = await whisperFn(audioPath);
    if (text) return ok(text);
    return err(new Error('Whisper returned empty transcription'));
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}
