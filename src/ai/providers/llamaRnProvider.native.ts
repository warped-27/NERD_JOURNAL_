import { initLlama, type LlamaContext } from 'llama.rn';
import type { AiProvider } from './types';

export const LLAMA_RN_AVAILABLE = true;

let _ctx: LlamaContext | null = null;

export async function initLlamaRnProvider(
  modelPath: string,
  onProgress?: (progress: number) => void,
): Promise<AiProvider> {
  if (_ctx) {
    await _ctx.release();
    _ctx = null;
  }

  _ctx = await initLlama(
    {
      model:        modelPath,
      n_ctx:        4096,
      n_gpu_layers: 99, // Metal on iOS, Vulkan on Android (falls back to CPU if unavailable)
      use_mlock:    true,
    },
    onProgress,
  );

  const ctx = _ctx;
  return {
    id:           'on-device',
    displayName:  'On-Device (llama.rn)',
    privacyLevel: 'on-device',
    async complete(prompt: string): Promise<string> {
      const result = await ctx.completion({
        messages:    [{ role: 'user', content: prompt }],
        n_predict:   1024,
        temperature: 0.3,
        stop:        ['<end_of_turn>', '<eos>', '</s>'],
      });
      return result.text.trim();
    },
  };
}

export async function releaseLlamaRnProvider(): Promise<void> {
  if (_ctx) {
    await _ctx.release();
    _ctx = null;
  }
}
