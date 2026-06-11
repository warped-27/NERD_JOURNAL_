import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { secretGet, secretSet } from '../crypto/secureSecrets';
import type { WebDavConfig } from './providers/webdavSync';
import type { ConflictInfo } from './syncRepository';

const SYNC_CFG_KEY  = 'nj_sync_config';
const SYNC_META_KEY = 'nj_sync_meta';

export type SyncProviderType = 'none' | 'webdav' | 'file';

export interface SyncConfig {
  provider: SyncProviderType;
  webdav?:  WebDavConfig;
}

interface SyncMeta {
  lastSyncAt: number | null;
  lastEtag:   string | null;
}

interface SyncContextValue {
  config:       SyncConfig;
  setConfig:    (c: SyncConfig) => Promise<void>;
  isSyncing:    boolean;
  setIsSyncing: (v: boolean) => void;
  lastSyncAt:   number | null;
  setLastSyncAt:(v: number) => void;
  lastEtag:     string | null;
  setLastEtag:  (v: string | null) => void;
  lastError:    string | null;
  setLastError: (v: string | null) => void;
  hasConfigured: boolean;
  showOnboarding: boolean;
  dismissOnboarding: () => void;
  triggerOnboarding: () => void;
  pendingConflicts:    ConflictInfo[];
  setPendingConflicts: (c: ConflictInfo[]) => void;
  clearConflicts:      () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [config,          setConfigState]     = useState<SyncConfig>({ provider: 'none' });
  const [isSyncing,       setIsSyncing]       = useState(false);
  const [lastSyncAt,      setLastSyncAtState] = useState<number | null>(null);
  const [lastEtag,        setLastEtagState]   = useState<string | null>(null);
  const [lastError,        setLastError]        = useState<string | null>(null);
  const [showOnboarding,   setShowOnboarding]   = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState<ConflictInfo[]>([]);

  const lastSyncAtRef = useRef<number | null>(null);
  const lastEtagRef   = useRef<string | null>(null);

  useEffect(() => {
    secretGet(SYNC_CFG_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as SyncConfig;
        const validProviders: SyncProviderType[] = ['none', 'webdav', 'file'];
        setConfigState(validProviders.includes(parsed.provider) ? parsed : { provider: 'none' });
      }
      catch { console.warn('[SyncContext] failed to parse stored sync config'); }
    });
    secretGet(SYNC_META_KEY).then((raw) => {
      if (!raw) return;
      try {
        const meta = JSON.parse(raw) as SyncMeta;
        if (meta.lastSyncAt != null) { lastSyncAtRef.current = meta.lastSyncAt; setLastSyncAtState(meta.lastSyncAt); }
        if (meta.lastEtag   != null) { lastEtagRef.current   = meta.lastEtag;   setLastEtagState(meta.lastEtag); }
      } catch {}
    });
  }, []);

  const setConfig = useCallback(async (c: SyncConfig) => {
    await secretSet(SYNC_CFG_KEY, JSON.stringify(c));
    setConfigState(c);
  }, []);

  const setLastSyncAt = useCallback((v: number) => {
    lastSyncAtRef.current = v;
    setLastSyncAtState(v);
    void secretSet(SYNC_META_KEY, JSON.stringify({ lastSyncAt: v, lastEtag: lastEtagRef.current }));
  }, []);

  const setLastEtag = useCallback((v: string | null) => {
    lastEtagRef.current = v;
    setLastEtagState(v);
    void secretSet(SYNC_META_KEY, JSON.stringify({ lastSyncAt: lastSyncAtRef.current, lastEtag: v }));
  }, []);

  const dismissOnboarding = useCallback(() => setShowOnboarding(false), []);
  const triggerOnboarding = useCallback(() => setShowOnboarding(true),  []);
  const clearConflicts    = useCallback(() => setPendingConflicts([]),   []);

  return (
    <SyncContext.Provider
      value={{
        config,
        setConfig,
        isSyncing,
        setIsSyncing,
        lastSyncAt,
        setLastSyncAt,
        lastEtag,
        setLastEtag,
        lastError,
        setLastError,
        hasConfigured: config.provider !== 'none',
        showOnboarding,
        dismissOnboarding,
        triggerOnboarding,
        pendingConflicts,
        setPendingConflicts,
        clearConflicts,
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
