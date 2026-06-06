import type { Result } from '../lib/result';
import { ok, err } from '../lib/result';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiRequest {
  prompt: string;
  apiKey: string;
  maxOutputTokens?: number;
  temperature?: number;
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message: string; code?: number };
}

export async function callGemini(req: GeminiRequest): Promise<Result<string, Error>> {
  const { prompt, apiKey, maxOutputTokens = 1024, temperature = 0.7 } = req;

  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      }),
    });
  } catch (e) {
    return err(new Error(`Network error: ${e instanceof Error ? e.message : String(e)}`));
  }

  let body: GeminiApiResponse;
  try {
    body = (await response.json()) as GeminiApiResponse;
  } catch {
    return err(new Error(`Invalid JSON response (status ${response.status})`));
  }

  if (!response.ok || body.error) {
    return err(new Error(body.error?.message ?? `API error ${response.status}`));
  }

  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return err(new Error('Empty response from Gemini'));

  return ok(text.trim());
}
