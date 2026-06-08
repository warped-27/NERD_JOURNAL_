import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { secretGet, secretSet } from '../crypto/secureSecrets';
import type { WebDavConfig } from './providers/webdavSync';

const SYNC_CFG_KEY = 'nj_sync_config';

export type SyncProviderType = 'none' | 'webdav' | 'file';

export interface SyncConfig {
  provider: SyncProviderType;
  webdav?:  WebDavConfig;
}

interface SyncContextValue {
  config:       SyncConfig;
  setConfig:    (c: SyncConfig) => Promise<void>;
  isSyncing:    boolean;
  setIsSyncing: (v: boolean) => void;
  lastSyncAt:   number | null;
  setLastSyncAt:(v: number) => void;
  lastError:    string | null;
  setLastError: (v: string | null) => void;
  hasConfigured: boolean;
  showOnboarding: boolean;
  dismissOnboarding: () => void;
  triggerOnboarding: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [config,          setConfigState]     = useState<SyncConfig>({ provider: 'none' });
  const [isSyncing,       setIsSyncing]       = useState(false);
  const [lastSyncAt,      setLastSyncAt]      = useState<number | null>(null);
  const [lastError,       setLastError]       = useState<string | null>(null);
  const [showOnboarding,  setShowOnboarding]  = useState(false);

  useEffect(() => {
    secretGet(SYNC_CFG_KEY).then((raw) => {
      if (!raw) return;
      try { setConfigState(JSON.parse(raw) as SyncConfig); } catch {}
    });
  }, []);

  const setConfig = useCallback(async (c: SyncConfig) => {
    await secretSet(SYNC_CFG_KEY, JSON.stringify(c));
    setConfigState(c);
  }, []);

  const dismissOnboarding = useCallback(() => setShowOnboarding(false), []);
  const triggerOnboarding = useCallback(() => setShowOnboarding(true),  []);

  return (
    <SyncContext.Provider
      value={{
        config,
        setConfig,
        isSyncing,
        setIsSyncing,
        lastSyncAt,
        setLastSyncAt,
        lastError,
        setLastError,
        hasConfigured: config.provider !== 'none',
        showOnboarding,
        dismissOnboarding,
        triggerOnboarding,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>');
  return ctx;
}
