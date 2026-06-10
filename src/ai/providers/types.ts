export type PrivacyLevel = 'on-device' | 'local' | 'cloud';

export interface AiProvider {
  readonly id:           string;
  readonly displayName:  string;
  readonly privacyLevel: PrivacyLevel;
  complete(prompt: string): Promise<string>;
}
