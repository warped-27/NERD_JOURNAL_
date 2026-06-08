import type { AiProvider } from './providers/types';
import type { Result } from '../lib/result';
import { ok, err } from '../lib/result';

export async function cascadeComplete(
  providers: AiProvider[],
  prompt: string,
): Promise<Result<string, Error>> {
  if (providers.length === 0) return err(new Error('No AI providers configured'));

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      return ok(await provider.complete(prompt));
    } catch (e) {
      errors.push(`${provider.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return err(new Error(`All AI providers failed:\n${errors.join('\n')}`));
}
