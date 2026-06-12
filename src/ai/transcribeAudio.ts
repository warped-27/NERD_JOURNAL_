import type { Result } from '../lib/result';
import { ok, err } from '../lib/result';
import { transcribeWithWhisperServer } from './whisper/whisperServerClient';

/**
 * Transcribe audio via the first available method:
 *   1. whisper.rn (native iOS/Android — fastest, fully offline)
 *   2. Local Whisper-compatible server (desktop — POST /v1/audio/transcriptions)
 */
export async function transcribeAudioWithFallback(
  audioPath:        string,
  base64Audio:      string,
  mimeType:         string,
  whisperFn:        ((path: string) => Promise<string | null>) | null,
  whisperServerUrl: string | null = null,
): Promise<Result<string, Error>> {
  if (whisperFn) {
    try {
      const text = await whisperFn(audioPath);
      if (text) return ok(text);
      return err(new Error('Whisper returned empty transcription'));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  if (whisperServerUrl) {
    try {
      const text = await transcribeWithWhisperServer(whisperServerUrl, base64Audio, mimeType);
      return ok(text);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  return err(new Error(
    'Voice transcription unavailable. ' +
    'On mobile: download the Whisper model in Settings → Local Transcription. ' +
    'On desktop: configure a Whisper server URL in Settings → Voice Transcription.',
  ));
}
