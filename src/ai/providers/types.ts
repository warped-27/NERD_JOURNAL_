export interface AiProvider {
  readonly id: string;
  complete(prompt: string): Promise<string>;
}
