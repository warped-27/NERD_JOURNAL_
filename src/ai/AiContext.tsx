import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Result } from '../lib/result';
import { err } from '../lib/result';
import { secretGet, secretSet, secretDelete } from '../crypto/secureSecrets';
import { askAi } from './aiService';

const AI_APIKEY_KEY       = 'nj_gemini_apikey';
const AI_CONSENT_KEY      = 'nj_gemini_consent';
const AI_MODEL_KEY        = 'nj_gemini_model';
const AI_AUTOENRICH_KEY   = 'nj_gemini_autoenrich';

export const GEMINI_MODELS = [
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (default)' },
  { id: 'gemini-3.0-flash',      label: 'Gemini 3.0 Flash' },
  { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
] as const;

export const DEFAULT_MODEL = GEMINI_MODELS[0].id;

interface AiContextValue {
  apiKey: string | null;
  setApiKey: (key: string) => Promise<void>;
  clearApiKey: () => Promise<void>;
  model: string;
  setModel: (model: string) => Promise<void>;
  hasConsented: boolean;
  giveConsent: () => Promise<void>;
  declineConsent: () => void;
  pendingConsent: boolean;
  requestWithConsent: (
    noteContent: string,
    instruction: string,
  ) => Promise<Result<string, Error>>;
  isLoading: boolean;
  autoEnrich: boolean;
  setAutoEnrich: (v: boolean) => Promise<void>;
}

const AiContext = createContext<AiContextValue | null>(null);

export function AiProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState]   = useState<string | null>(null);
  const [model,  setModelState]    = useState<string>(DEFAULT_MODEL);
  const [hasConsented, setHasConsented] = useState(false);
  const [pendingConsent, setPendingConsent] = useState(false);
  const [isLoading, setIsLoading]  = useState(false);
  const [autoEnrich, setAutoEnrichState] = useState(false);

  const pendingCallRef = useRef<{
    noteContent: string;
    instruction: string;
    resolve: (r: Result<string, Error>) => void;
  } | null>(null);

  const loadSettings = useCallback(async () => {
    const key          = await secretGet(AI_APIKEY_KEY);
    const consent      = await secretGet(AI_CONSENT_KEY);
    const saved        = await secretGet(AI_MODEL_KEY);
    const autoEnrichSaved = await secretGet(AI_AUTOENRICH_KEY);
    setApiKeyState(key);
    setHasConsented(consent === '1');
    if (saved) setModelState(saved);
    setAutoEnrichState(autoEnrichSaved === '1');
  }, []);

  React.useEffect(() => { void loadSettings(); }, [loadSettings]);

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

  const giveConsent = useCallback(async () => {
    await secretSet(AI_CONSENT_KEY, '1');
    setHasConsented(true);
    setPendingConsent(false);

    const pending = pendingCallRef.current;
    if (pending && apiKey) {
      pendingCallRef.current = null;
      setIsLoading(true);
      const result = await askAi({
        noteContent: pending.noteContent,
        instruction: pending.instruction,
        apiKey,
        model,
      });
      setIsLoading(false);
      pending.resolve(result);
    }
  }, [apiKey, model]);

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

  const requestWithConsent = useCallback(
    (noteContent: string, instruction: string): Promise<Result<string, Error>> => {
      if (!apiKey) return Promise.resolve(err(new Error('No API key configured')));

      if (!hasConsented) {
        return new Promise((resolve) => {
          pendingCallRef.current = { noteContent, instruction, resolve };
          setPendingConsent(true);
        });
      }

      setIsLoading(true);
      return askAi({ noteContent, instruction, apiKey, model }).finally(() =>
        setIsLoading(false),
      );
    },
    [apiKey, hasConsented, model],
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
