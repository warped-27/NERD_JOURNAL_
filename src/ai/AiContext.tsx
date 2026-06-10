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
import { makeClaudeProvider, type ClaudeConfig, DEFAULT_CLAUDE_MODEL } from './providers/claudeProvider';
import { useOnDevice } from './onDevice/OnDeviceContext';
import type { AiProvider } from './providers/types';

export type { ClaudeConfig };

const AI_APIKEY_KEY        = 'nj_gemini_apikey';
const AI_CONSENT_KEY       = 'nj_gemini_consent';
const AI_MODEL_KEY         = 'nj_gemini_model';
const AI_AUTOENRICH_KEY    = 'nj_gemini_autoenrich';
const AI_OLLAMA_CONFIG_KEY = 'nj_ollama_config';
const AI_MLX_CONFIG_KEY    = 'nj_mlx_config';
const AI_CUSTOM_CONFIG_KEY = 'nj_custom_config';
const AI_CLAUDE_CONFIG_KEY = 'nj_claude_config';

export const GEMINI_MODELS = [
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (default)' },
  { id: 'gemini-3.5-flash',      label: 'Gemini 3.5 Flash' },
  { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
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

export interface CustomProviderConfig {
  enabled: boolean;
  baseUrl: string;
  model:   string;
  /** Display name shown in Settings */
  name:    string;
  /** Optional API key for cloud OpenAI-compatible endpoints */
  apiKey?: string;
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

const DEFAULT_CUSTOM_CONFIG: CustomProviderConfig = {
  enabled: false,
  baseUrl: 'http://localhost:4000',
  model:   'gpt-4o-mini',
  name:    'Custom (LiteLLM / OpenAI-compatible)',
  apiKey:  '',
};

const DEFAULT_CLAUDE_CONFIG: ClaudeConfig = {
  enabled: false,
  apiKey:  '',
  model:   DEFAULT_CLAUDE_MODEL,
};

interface AiContextValue {
  // Gemini
  apiKey: string | null;
  setApiKey:   (key: string)   => Promise<void>;
  clearApiKey: ()              => Promise<void>;
  model:    string;
  setModel: (model: string)    => Promise<void>;
  // Consent
  hasConsented:      boolean;
  giveConsent:       ()    => Promise<void>;
  declineConsent:    ()    => void;
  pendingConsent:    boolean;
  /** Name of the first cloud provider in the cascade (e.g. "Google Gemini"), or null if none. */
  cloudProviderName: string | null;
  /** True when providers include at least one cloud endpoint. */
  hasCloudProvider:  boolean;
  /** True when auto-enrich can run: either consented or all providers are local/on-device. */
  canAutoEnrich:     boolean;
  // Interaction
  requestWithConsent: (noteContent: string, instruction: string) => Promise<Result<string, Error>>;
  doComplete: (prompt: string) => Promise<Result<string, Error>>;
  isLoading:  boolean;
  // Auto-enrich
  autoEnrich:    boolean;
  setAutoEnrich: (v: boolean) => Promise<void>;
  // Local providers
  hasAnyProvider:  boolean;
  ollamaConfig:      OllamaConfig;
  mlxConfig:         MlxConfig;
  customConfig:      CustomProviderConfig;
  claudeConfig:      ClaudeConfig;
  setOllamaConfig:   (c: OllamaConfig)         => Promise<void>;
  setMlxConfig:      (c: MlxConfig)             => Promise<void>;
  setCustomConfig:   (c: CustomProviderConfig)  => Promise<void>;
  setClaudeConfig:   (c: ClaudeConfig)          => Promise<void>;
}

const AiContext = createContext<AiContextValue | null>(null);

export function AiProvider({ children }: { children: ReactNode }) {
  const onDevice = useOnDevice();
  const [apiKey, setApiKeyState]   = useState<string | null>(null);
  const [model,  setModelState]    = useState<string>(DEFAULT_MODEL);
  const [hasConsented, setHasConsented] = useState(false);
  const [pendingConsent, setPendingConsent] = useState(false);
  const [isLoading, setIsLoading]  = useState(false);
  const [autoEnrich, setAutoEnrichState] = useState(false);
  const [ollamaConfig,  setOllamaConfigState]  = useState<OllamaConfig>(DEFAULT_OLLAMA_CONFIG);
  const [mlxConfig,     setMlxConfigState]     = useState<MlxConfig>(DEFAULT_MLX_CONFIG);
  const [customConfig,  setCustomConfigState]  = useState<CustomProviderConfig>(DEFAULT_CUSTOM_CONFIG);
  const [claudeConfig,  setClaudeConfigState]  = useState<ClaudeConfig>(DEFAULT_CLAUDE_CONFIG);

  const pendingCallRef = useRef<{
    noteContent: string;
    instruction: string;
    resolve: (r: Result<string, Error>) => void;
  } | null>(null);

  // ── Provider list (local-first: on-device → Ollama → MLX → Custom → Claude → Gemini) ──
  const providers = useMemo((): AiProvider[] => {
    const list: AiProvider[] = [];
    if (onDevice.provider) {
      list.push(onDevice.provider);
    }
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
    if (customConfig.enabled && customConfig.baseUrl && customConfig.model) {
      list.push(makeOpenAiCompatProvider({
        id:          'custom',
        displayName: customConfig.name || 'Custom',
        baseUrl:     customConfig.baseUrl,
        model:       customConfig.model,
        apiKey:      customConfig.apiKey,
      }));
    }
    if (claudeConfig.enabled && claudeConfig.apiKey && claudeConfig.model) {
      list.push(makeClaudeProvider(claudeConfig));
    }
    if (apiKey) {
      list.push(makeGeminiProvider(apiKey, model));
    }
    return list;
  }, [onDevice.provider, ollamaConfig, mlxConfig, customConfig, claudeConfig, apiKey, model]);

  // ── Cloud-provider metadata (drives consent dialog) ───────────────────────
  const cloudProviders     = useMemo(() => providers.filter((p) => p.privacyLevel === 'cloud'), [providers]);
  const cloudProviderName  = useMemo(() => cloudProviders[0]?.displayName ?? null, [cloudProviders]);
  const hasCloudProvider   = cloudProviders.length > 0;
  const canAutoEnrich      = useMemo(
    () => hasConsented || !hasCloudProvider,
    [hasConsented, hasCloudProvider],
  );

  // ── Load persisted settings ────────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    const [key, consent, savedModel, autoEnrichSaved, ollamaSaved, mlxSaved, customSaved, claudeSaved] =
      await Promise.all([
        secretGet(AI_APIKEY_KEY),
        secretGet(AI_CONSENT_KEY),
        secretGet(AI_MODEL_KEY),
        secretGet(AI_AUTOENRICH_KEY),
        secretGet(AI_OLLAMA_CONFIG_KEY),
        secretGet(AI_MLX_CONFIG_KEY),
        secretGet(AI_CUSTOM_CONFIG_KEY),
        secretGet(AI_CLAUDE_CONFIG_KEY),
      ]);

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
    if (customSaved) {
      try { setCustomConfigState(JSON.parse(customSaved) as CustomProviderConfig); } catch {}
    }
    if (claudeSaved) {
      try { setClaudeConfigState(JSON.parse(claudeSaved) as ClaudeConfig); } catch {}
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

  // ── Local / cloud provider config ─────────────────────────────────────────
  const setOllamaConfig = useCallback(async (c: OllamaConfig) => {
    await secretSet(AI_OLLAMA_CONFIG_KEY, JSON.stringify(c));
    setOllamaConfigState(c);
  }, []);

  const setMlxConfig = useCallback(async (c: MlxConfig) => {
    await secretSet(AI_MLX_CONFIG_KEY, JSON.stringify(c));
    setMlxConfigState(c);
  }, []);

  const setCustomConfig = useCallback(async (c: CustomProviderConfig) => {
    await secretSet(AI_CUSTOM_CONFIG_KEY, JSON.stringify(c));
    setCustomConfigState(c);
  }, []);

  const setClaudeConfig = useCallback(async (c: ClaudeConfig) => {
    await secretSet(AI_CLAUDE_CONFIG_KEY, JSON.stringify(c));
    setClaudeConfigState(c);
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

      // Consent required only when the cascade includes at least one cloud provider
      if (cloudProviders.length > 0 && !hasConsented) {
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
    [providers, cloudProviders, hasConsented],
  );

  // ── Direct cascade for background tasks (enrichment) ─────────────────────
  // If no consent yet, only run through local/on-device providers so note
  // content never reaches a cloud endpoint in the background.
  const doComplete = useCallback(
    (prompt: string) => {
      const safe = hasConsented ? providers : providers.filter((p) => p.privacyLevel !== 'cloud');
      return cascadeComplete(safe, prompt);
    },
    [providers, hasConsented],
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
        cloudProviderName,
        hasCloudProvider,
        canAutoEnrich,
        requestWithConsent,
        doComplete,
        isLoading,
        autoEnrich,
        setAutoEnrich,
        hasAnyProvider: providers.length > 0,
        ollamaConfig,
        mlxConfig,
        customConfig,
        claudeConfig,
        setOllamaConfig,
        setMlxConfig,
        setCustomConfig,
        setClaudeConfig,
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
