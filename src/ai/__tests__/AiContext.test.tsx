import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AiProvider, useAi } from '../AiContext';
import * as secureSecrets from '../../crypto/secureSecrets';
import * as aiService from '../aiService';
import { ok } from '../../lib/result';

jest.mock('../../crypto/secureSecrets');
jest.mock('../aiService');
jest.mock('../onDevice/OnDeviceContext', () => ({
  useOnDevice: () => ({
    provider:         null,
    status:           'unavailable',
    downloadProgress: 0,
    errorMessage:     null,
    modelInfo:        { id: 'test', name: 'Test', sizeBytes: 0, url: '', filename: '' },
    startDownload:    jest.fn(),
    cancelDownload:   jest.fn(),
    loadModel:        jest.fn(),
    unloadModel:      jest.fn(),
    deleteLocalModel: jest.fn(),
  }),
}));

const mockSecretGet = secureSecrets.secretGet as jest.MockedFunction<typeof secureSecrets.secretGet>;
const mockSecretSet = secureSecrets.secretSet as jest.MockedFunction<typeof secureSecrets.secretSet>;
const mockAskAi = aiService.askAi as jest.MockedFunction<typeof aiService.askAi>;

function TestConsumer({ onValue }: { onValue: (v: ReturnType<typeof useAi>) => void }) {
  const ctx = useAi();
  onValue(ctx);
  return null;
}

function renderWithProvider(onValue: (v: ReturnType<typeof useAi>) => void) {
  return TestRenderer.create(
    <AiProvider>
      <TestConsumer onValue={onValue} />
    </AiProvider>,
  );
}

describe('AiContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecretGet.mockResolvedValue(null);
    mockSecretSet.mockResolvedValue(undefined);
  });

  it('starts with no providers and hasAnyProvider false', async () => {
    let ctx!: ReturnType<typeof useAi>;
    await act(async () => {
      renderWithProvider((v) => (ctx = v));
    });
    expect(ctx.hasAnyProvider).toBe(false);
    expect(ctx.autoEnrich).toBe(false);
  });

  it('loads persisted Ollama config on mount', async () => {
    const storedCfg = JSON.stringify({ enabled: true, baseUrl: 'http://localhost:11434', model: 'llama3.2:3b' });
    mockSecretGet.mockImplementation(async (key) => {
      if (key === 'nj_ollama_config') return storedCfg;
      return null;
    });
    let ctx!: ReturnType<typeof useAi>;
    await act(async () => {
      renderWithProvider((v) => (ctx = v));
    });
    expect(ctx.ollamaConfig.enabled).toBe(true);
    expect(ctx.ollamaConfig.baseUrl).toBe('http://localhost:11434');
    expect(ctx.hasAnyProvider).toBe(true);
  });

  it('loads persisted MLX config on mount', async () => {
    const storedCfg = JSON.stringify({ enabled: true, baseUrl: 'http://localhost:8080', model: 'mlx-model' });
    mockSecretGet.mockImplementation(async (key) => {
      if (key === 'nj_mlx_config') return storedCfg;
      return null;
    });
    let ctx!: ReturnType<typeof useAi>;
    await act(async () => {
      renderWithProvider((v) => (ctx = v));
    });
    expect(ctx.mlxConfig.enabled).toBe(true);
    expect(ctx.hasAnyProvider).toBe(true);
  });

  it('loads persisted autoEnrich on mount', async () => {
    mockSecretGet.mockImplementation(async (key) => {
      if (key === 'nj_ai_autoenrich') return '1';
      return null;
    });
    let ctx!: ReturnType<typeof useAi>;
    await act(async () => {
      renderWithProvider((v) => (ctx = v));
    });
    expect(ctx.autoEnrich).toBe(true);
  });

  it('setOllamaConfig persists and updates state', async () => {
    let ctx!: ReturnType<typeof useAi>;
    await act(async () => {
      renderWithProvider((v) => (ctx = v));
    });
    const newCfg = { enabled: true, baseUrl: 'http://localhost:11434', model: 'llama3.2:3b' };
    await act(async () => {
      await ctx.setOllamaConfig(newCfg);
    });
    expect(mockSecretSet).toHaveBeenCalledWith('nj_ollama_config', JSON.stringify(newCfg));
    expect(ctx.ollamaConfig).toEqual(newCfg);
  });

  it('setMlxConfig persists and updates state', async () => {
    let ctx!: ReturnType<typeof useAi>;
    await act(async () => {
      renderWithProvider((v) => (ctx = v));
    });
    const newCfg = { enabled: true, baseUrl: 'http://localhost:8080', model: 'mlx-model' };
    await act(async () => {
      await ctx.setMlxConfig(newCfg);
    });
    expect(mockSecretSet).toHaveBeenCalledWith('nj_mlx_config', JSON.stringify(newCfg));
  });

  it('setAutoEnrich persists and updates state', async () => {
    let ctx!: ReturnType<typeof useAi>;
    await act(async () => {
      renderWithProvider((v) => (ctx = v));
    });
    await act(async () => {
      await ctx.setAutoEnrich(true);
    });
    expect(mockSecretSet).toHaveBeenCalledWith('nj_ai_autoenrich', '1');
    expect(ctx.autoEnrich).toBe(true);
  });

  it('ask returns err when no providers configured', async () => {
    let ctx!: ReturnType<typeof useAi>;
    await act(async () => {
      renderWithProvider((v) => (ctx = v));
    });
    let result!: Awaited<ReturnType<typeof ctx.ask>>;
    await act(async () => {
      result = await ctx.ask('content', 'summarize');
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('No AI providers');
  });

  it('ask calls askAi when providers are available', async () => {
    const storedCfg = JSON.stringify({ enabled: true, baseUrl: 'https://ollama.example.com', model: 'llama3.2:3b' });
    mockSecretGet.mockImplementation(async (key) => {
      if (key === 'nj_ollama_config') return storedCfg;
      return null;
    });
    mockAskAi.mockResolvedValue(ok('AI response'));

    let ctx!: ReturnType<typeof useAi>;
    await act(async () => {
      renderWithProvider((v) => (ctx = v));
    });
    let result!: Awaited<ReturnType<typeof ctx.ask>>;
    await act(async () => {
      result = await ctx.ask('my note', 'summarize');
    });
    expect(mockAskAi).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('AI response');
  });
});
