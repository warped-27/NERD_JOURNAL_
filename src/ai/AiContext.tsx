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

const AI_APIKEY_KEY = 'nj_gemini_apikey';
const AI_CONSENT_KEY = 'nj_gemini_consent';

interface AiContextValue {
  apiKey: string | null;
  setApiKey: (key: string) => Promise<void>;
  clearApiKey: () => Promise<void>;
  hasConsented: boolean;
  giveConsent: () => Promise<void>;
  pendingConsent: boolean;
  requestWithConsent: (
    noteContent: string,
    instruction: string,
  ) => Promise<Result<string, Error>>;
  isLoading: boolean;
}

const AiContext = createContext<AiContextValue | null>(null);

export function AiProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [hasConsented, setHasConsented] = useState(false);
  const [pendingConsent, setPendingConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Pending call waiting for consent
  const pendingCallRef = useRef<{
    noteContent: string;
    instruction: string;
    resolve: (r: Result<string, Error>) => void;
  } | null>(null);

  const loadApiKey = useCallback(async () => {
    const key = await secretGet(AI_APIKEY_KEY);
    const consent = await secretGet(AI_CONSENT_KEY);
    setApiKeyState(key);
    setHasConsented(consent === '1');
  }, []);

  // Load on mount
  React.useEffect(() => {
    void loadApiKey();
  }, [loadApiKey]);

  const setApiKey = useCallback(async (key: string) => {
    await secretSet(AI_APIKEY_KEY, key.trim());
    setApiKeyState(key.trim() || null);
  }, []);

  const clearApiKey = useCallback(async () => {
    await secretDelete(AI_APIKEY_KEY);
    setApiKeyState(null);
  }, []);

  const giveConsent = useCallback(async () => {
    await secretSet(AI_CONSENT_KEY, '1');
    setHasConsented(true);
    setPendingConsent(false);

    // Resume pending call
    const pending = pendingCallRef.current;
    if (pending && apiKey) {
      pendingCallRef.current = null;
      setIsLoading(true);
      const result = await askAi({
        noteContent: pending.noteContent,
        instruction: pending.instruction,
        apiKey,
      });
      setIsLoading(false);
      pending.resolve(result);
    }
  }, [apiKey]);

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
      return askAi({ noteContent, instruction, apiKey }).finally(() =>
        setIsLoading(false),
      );
    },
    [apiKey, hasConsented],
  );

  return (
    <AiContext.Provider
      value={{
        apiKey,
        setApiKey,
        clearApiKey,
        hasConsented,
        giveConsent,
        pendingConsent,
        requestWithConsent,
        isLoading,
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
