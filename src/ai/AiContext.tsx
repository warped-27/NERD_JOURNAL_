import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import type { Result } from '../lib/result';
import { err } from '../lib/result';
import { secretGet, secretSet } from '../crypto/secureSecrets';
import { askAi } from './aiService';
import { cascadeComplete } from './providerCascade';
import { makeOpenAiCompatProvider } from './providers/openAiCompatProvider';
import { useOnDevice } from './onDevice/OnDeviceContext';
import type { AiProvider as AiProviderType } from './providers/types';

const AI_AUTOENRICH_KEY          = 'nj_ai_autoenrich';
const AI_OLLAMA_CONFIG_KEY       = 'nj_ollama_config';
const AI_MLX_CONFIG_KEY          = 'nj_mlx_config';
const AI_WHISPER_SERVER_KEY      = 'nj_whisper_server_config';

export interface OllamaConfig {
  enabled: boolean;
  baseUrl: string;
  model:   string;
}

export interface MlxConfig {
  enabled: boolean;
  baseUrl: string;
  model:   string;
}

export interface WhisperServerConfig {
  enabled: boolean;
  baseUrl: string;
}

const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
  enabled: false,
  baseUrl: 'http://localhost:11434',
  model:   'llama3.2:3b',
};

const DEFAULT_MLX_CONFIG: MlxConfig = {
  enabled: false,
  baseUrl: 'http://localhost:8080',
  model:   'mlx-community/Llama-3.2-3B-Instruct-4bit',
};

const DEFAULT_WHISPER_SERVER_CONFIG: WhisperServerConfig = {
  enabled: false,
  baseUrl: 'http://localhost:8000',
};

interface AiContextValue {
  // Provider cascade (local only: on-device → Ollama → MLX)
  hasAnyProvider:  boolean;
  ollamaConfig:    OllamaConfig;
  mlxConfig:       MlxConfig;
  setOllamaConfig:       (c: OllamaConfig)       => Promise<void>;
  setMlxConfig:          (c: MlxConfig)          => Promise<void>;
  whisperServerConfig:    WhisperServerConfig;
  setWhisperServerConfig: (c: WhisperServerConfig) => Promise<void>;
  // AI interaction
  ask:        (noteContent: string, instruction: string) => Promise<Result<string, Error>>;
  doComplete: (prompt: string)                           => Promise<Result<string, Error>>;
  isLoading:  boolean;
  // Auto-enrich
  autoEnrich:    boolean;
  setAutoEnrich: (v: boolean) => Promise<void>;
}

const AiContext = createContext<AiContextValue | null>(null);

export function AiProvider({ children }: { children: ReactNode }) {
  const onDevice = useOnDevice();
  const [isLoading, setIsLoading]         = useState(false);
  const [autoEnrich, setAutoEnrichState]  = useState(false);
  const [ollamaConfig,       setOllamaConfigState]       = useState<OllamaConfig>(DEFAULT_OLLAMA_CONFIG);
  const [mlxConfig,          setMlxConfigState]          = useState<MlxConfig>(DEFAULT_MLX_CONFIG);
  const [whisperServerConfig, setWhisperServerConfigState] = useState<WhisperServerConfig>(DEFAULT_WHISPER_SERVER_CONFIG);

  // ── Provider list (local-first: on-device → Ollama → MLX) ────────────────
  const providers = useMemo((): AiProviderType[] => {
    const list: AiProviderType[] = [];
    if (onDevice.provider) list.push(onDevice.provider);
    if (ollamaConfig.enabled && ollamaConfig.baseUrl && ollamaConfig.model) {
      list.push(makeOpenAiCompatProvider({
        id:          'ollama',
        displayName: 'Ollama (local)',
        baseUrl:     ollamaConfig.baseUrl,
        model:       ollamaConfig.model,
      }));
    }
    if (mlxConfig.enabled && mlxConfig.baseUrl && mlxConfig.model) {
      list.push(makeOpenAiCompatProvider({
        id:          'mlx',
        displayName: 'MLX (local)',
        baseUrl:     mlxConfig.baseUrl,
        model:       mlxConfig.model,
      }));
    }
    return list;
  }, [onDevice.provider, ollamaConfig, mlxConfig]);

  // ── Load persisted settings ───────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    const [autoEnrichSaved, ollamaSaved, mlxSaved, whisperServerSaved, legacyAutoEnrich] = await Promise.all([
      secretGet(AI_AUTOENRICH_KEY),
      secretGet(AI_OLLAMA_CONFIG_KEY),
      secretGet(AI_MLX_CONFIG_KEY),
      secretGet(AI_WHISPER_SERVER_KEY),
      secretGet('nj_gemini_autoenrich'),
    ]);
    // Migrate legacy key written by older versions
    const autoEnrichValue = autoEnrichSaved ?? legacyAutoEnrich;
    setAutoEnrichState(autoEnrichValue === '1');
    if (autoEnrichSaved === null && legacyAutoEnrich !== null) {
      void secretSet(AI_AUTOENRICH_KEY, legacyAutoEnrich);
    }
    if (ollamaSaved) {
      try { setOllamaConfigState(JSON.parse(ollamaSaved) as OllamaConfig); } catch {}
    }
    if (mlxSaved) {
      try { setMlxConfigState(JSON.parse(mlxSaved) as MlxConfig); } catch {}
    }
    if (whisperServerSaved) {
      try { setWhisperServerConfigState(JSON.parse(whisperServerSaved) as WhisperServerConfig); } catch {}
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => { void loadSettings(); }, [loadSettings]);

  // ── Provider config setters ───────────────────────────────────────────────
  const setOllamaConfig = useCallback(async (c: OllamaConfig) => {
    await secretSet(AI_OLLAMA_CONFIG_KEY, JSON.stringify(c));
    setOllamaConfigState(c);
  }, []);

  const setMlxConfig = useCallback(async (c: MlxConfig) => {
    await secretSet(AI_MLX_CONFIG_KEY, JSON.stringify(c));
    setMlxConfigState(c);
  }, []);

  const setWhisperServerConfig = useCallback(async (c: WhisperServerConfig) => {
    await secretSet(AI_WHISPER_SERVER_KEY, JSON.stringify(c));
    setWhisperServerConfigState(c);
  }, []);

  const setAutoEnrich = useCallback(async (v: boolean) => {
    await secretSet(AI_AUTOENRICH_KEY, v ? '1' : '0');
    setAutoEnrichState(v);
  }, []);

  // ── AI calls (no consent gate — all providers are local) ─────────────────
  const ask = useCallback(
    (noteContent: string, instruction: string): Promise<Result<string, Error>> => {
      if (providers.length === 0) {
        return Promise.resolve(err(new Error('No AI providers configured. Enable Ollama, MLX, or download the on-device model in Settings.')));
      }
      setIsLoading(true);
      return askAi({ noteContent, instruction, providers }).finally(() => setIsLoading(false));
    },
    [providers],
  );

  const doComplete = useCallback(
    (prompt: string) => cascadeComplete(providers, prompt),
    [providers],
  );

  return (
    <AiContext.Provider
      value={{
        hasAnyProvider: providers.length > 0,
        ollamaConfig,
        mlxConfig,
        whisperServerConfig,
        setOllamaConfig,
        setMlxConfig,
        setWhisperServerConfig,
        ask,
        doComplete,
        isLoading,
        autoEnrich,
        setAutoEnrich,
      }}
    >
      {children}
    </AiContext.Provider>
  );
}

export function useAi(): AiContextValue {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error('useAi must be used inside AiProvider');
  return ctx;
}
