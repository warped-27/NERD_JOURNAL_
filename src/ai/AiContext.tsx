import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Result } from '../lib/result';
import { err } from '../lib/result';
import { secretGet, secretSet, secretDelete } from '../crypto/secureSecrets';
import { askAi } from './aiService';
import { cascadeComplete } from './providerCascade';
import { makeGeminiProvider } from './providers/geminiProvider';
import { makeOpenAiCompatProvider } from './providers/openAiCompatProvider';
import type { AiProvider } from './providers/types';

const AI_APIKEY_KEY       = 'nj_gemini_apikey';
const AI_CONSENT_KEY      = 'nj_gemini_consent';
const AI_MODEL_KEY        = 'nj_gemini_model';
const AI_AUTOENRICH_KEY   = 'nj_gemini_autoenrich';
const AI_OLLAMA_CONFIG_KEY = 'nj_ollama_config';
const AI_MLX_CONFIG_KEY    = 'nj_mlx_config';

export const GEMINI_MODELS = [
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (default)' },
  { id: 'gemini-3.0-flash',      label: 'Gemini 3.0 Flash' },
  { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
] as const;

export const DEFAULT_MODEL = GEMINI_MODELS[0].id;

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

interface AiContextValue {
  // Gemini
  apiKey: string | null;
  setApiKey:   (key: string)   => Promise<void>;
  clearApiKey: ()              => Promise<void>;
  model:    string;
  setModel: (model: string)    => Promise<void>;
  // Consent
  hasConsented:   boolean;
  giveConsent:    ()    => Promise<void>;
  declineConsent: ()    => void;
  pendingConsent: boolean;
  // Interaction
  requestWithConsent: (noteContent: string, instruction: string) => Promise<Result<string, Error>>;
  doComplete: (prompt: string) => Promise<Result<string, Error>>;
  isLoading:  boolean;
  // Auto-enrich
  autoEnrich:    boolean;
  setAutoEnrich: (v: boolean) => Promise<void>;
  // Local providers
  hasAnyProvider:  boolean;
  ollamaConfig:    OllamaConfig;
  mlxConfig:       MlxConfig;
  setOllamaConfig: (c: OllamaConfig) => Promise<void>;
  setMlxConfig:    (c: MlxConfig)    => Promise<void>;
}

const AiContext = createContext<AiContextValue | null>(null);

export function AiProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState]   = useState<string | null>(null);
  const [model,  setModelState]    = useState<string>(DEFAULT_MODEL);
  const [hasConsented, setHasConsented] = useState(false);
  const [pendingConsent, setPendingConsent] = useState(false);
  const [isLoading, setIsLoading]  = useState(false);
  const [autoEnrich, setAutoEnrichState] = useState(false);
  const [ollamaConfig, setOllamaConfigState] = useState<OllamaConfig>(DEFAULT_OLLAMA_CONFIG);
  const [mlxConfig, setMlxConfigState]       = useState<MlxConfig>(DEFAULT_MLX_CONFIG);

  const pendingCallRef = useRef<{
    noteContent: string;
    instruction: string;
    resolve: (r: Result<string, Error>) => void;
  } | null>(null);

  // ── Provider list (local-first: Ollama → MLX → Gemini) ────────────────────
  const providers = useMemo((): AiProvider[] => {
    const list: AiProvider[] = [];
    if (ollamaConfig.enabled && ollamaConfig.baseUrl && ollamaConfig.model) {
      list.push(makeOpenAiCompatProvider({
        id:      'ollama',
        baseUrl: ollamaConfig.baseUrl,
        model:   ollamaConfig.model,
      }));
    }
    if (mlxConfig.enabled && mlxConfig.baseUrl && mlxConfig.model) {
      list.push(makeOpenAiCompatProvider({
        id:      'mlx',
        baseUrl: mlxConfig.baseUrl,
        model:   mlxConfig.model,
      }));
    }
    if (apiKey) {
      list.push(makeGeminiProvider(apiKey, model));
    }
    return list;
  }, [ollamaConfig, mlxConfig, apiKey, model]);

  // ── Load persisted settings ────────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    const key             = await secretGet(AI_APIKEY_KEY);
    const consent         = await secretGet(AI_CONSENT_KEY);
    const savedModel      = await secretGet(AI_MODEL_KEY);
    const autoEnrichSaved = await secretGet(AI_AUTOENRICH_KEY);
    const ollamaSaved     = await secretGet(AI_OLLAMA_CONFIG_KEY);
    const mlxSaved        = await secretGet(AI_MLX_CONFIG_KEY);

    setApiKeyState(key);
    setHasConsented(consent === '1');
    if (savedModel) setModelState(savedModel);
    setAutoEnrichState(autoEnrichSaved === '1');
    if (ollamaSaved) {
      try { setOllamaConfigState(JSON.parse(ollamaSaved) as OllamaConfig); } catch {}
    }
    if (mlxSaved) {
      try { setMlxConfigState(JSON.parse(mlxSaved) as MlxConfig); } catch {}
    }
  }, []);

  React.useEffect(() => { void loadSettings(); }, [loadSettings]);

  // ── Gemini key / model ─────────────────────────────────────────────────────
  const setApiKey = useCallback(async (key: string) => {
    await secretSet(AI_APIKEY_KEY, key.trim());
    setApiKeyState(key.trim() || null);
  }, []);

  const clearApiKey = useCallback(async () => {
    await secretDelete(AI_APIKEY_KEY);
    setApiKeyState(null);
  }, []);

  const setModel = useCallback(async (m: string) => {
    await secretSet(AI_MODEL_KEY, m);
    setModelState(m);
  }, []);

  // ── Local provider config ─────────────────────────────────────────────────
  const setOllamaConfig = useCallback(async (c: OllamaConfig) => {
    await secretSet(AI_OLLAMA_CONFIG_KEY, JSON.stringify(c));
    setOllamaConfigState(c);
  }, []);

  const setMlxConfig = useCallback(async (c: MlxConfig) => {
    await secretSet(AI_MLX_CONFIG_KEY, JSON.stringify(c));
    setMlxConfigState(c);
  }, []);

  // ── Consent ────────────────────────────────────────────────────────────────
  const giveConsent = useCallback(async () => {
    await secretSet(AI_CONSENT_KEY, '1');
    setHasConsented(true);
    setPendingConsent(false);

    const pending = pendingCallRef.current;
    if (pending && providers.length > 0) {
      pendingCallRef.current = null;
      setIsLoading(true);
      const result = await askAi({
        noteContent: pending.noteContent,
        instruction: pending.instruction,
        providers,
      });
      setIsLoading(false);
      pending.resolve(result);
    }
  }, [providers]);

  const declineConsent = useCallback(() => {
    const pending = pendingCallRef.current;
    if (pending) {
      pendingCallRef.current = null;
      pending.resolve(err(new Error('AI consent declined')));
    }
    setPendingConsent(false);
  }, []);

  const setAutoEnrich = useCallback(async (v: boolean) => {
    await secretSet(AI_AUTOENRICH_KEY, v ? '1' : '0');
    setAutoEnrichState(v);
  }, []);

  // ── Main AI call ───────────────────────────────────────────────────────────
  const requestWithConsent = useCallback(
    (noteContent: string, instruction: string): Promise<Result<string, Error>> => {
      if (providers.length === 0) {
        return Promise.resolve(err(new Error('No AI providers configured')));
      }

      if (!hasConsented) {
        return new Promise((resolve) => {
          pendingCallRef.current = { noteContent, instruction, resolve };
          setPendingConsent(true);
        });
      }

      setIsLoading(true);
      return askAi({ noteContent, instruction, providers }).finally(() =>
        setIsLoading(false),
      );
    },
    [providers, hasConsented],
  );

  // ── Direct cascade for background tasks (enrichment) ─────────────────────
  const doComplete = useCallback(
    (prompt: string) => cascadeComplete(providers, prompt),
    [providers],
  );

  return (
    <AiContext.Provider
      value={{
        apiKey,
        setApiKey,
        clearApiKey,
        model,
        setModel,
        hasConsented,
        giveConsent,
        declineConsent,
        pendingConsent,
        requestWithConsent,
        doComplete,
        isLoading,
        autoEnrich,
        setAutoEnrich,
        hasAnyProvider: providers.length > 0,
        ollamaConfig,
        mlxConfig,
        setOllamaConfig,
        setMlxConfig,
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
