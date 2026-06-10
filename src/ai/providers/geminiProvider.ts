import { callGemini } from '../geminiService';
import type { AiProvider } from './types';

export function makeGeminiProvider(apiKey: string, model?: string): AiProvider {
  return {
    id:           'gemini',
    displayName:  'Google Gemini',
    privacyLevel: 'cloud',
    async complete(prompt: string): Promise<string> {
      const result = await callGemini({ prompt, apiKey, model, temperature: 0.7 });
      if (!result.ok) throw result.error;
      return result.value;
    },
  };
}
