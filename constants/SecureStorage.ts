import { Platform } from 'react-native';

export interface CloudConfig {
  provider: 'google_drive' | 'icloud' | 'webdav' | 'none';
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;
  accessToken?: string;
  googleClientId?: string;
}

export interface AIConfig {
  provider: 'gemini' | 'openai' | 'ollama' | 'none';
  apiKey?: string;
  customEndpoint?: string;
  modelName?: string;
}

// In-memory fallback per la persistenza su native se localStorage non è presente
const memoryStore: Record<string, string> = {};

const STORAGE_KEYS = {
  MASTER_PASSWORD: '@journalai_master_password',
  CLOUD_CONFIG: '@journalai_cloud_config',
  AI_CONFIG: '@journalai_ai_config',
};

const getStorageItem = async (key: string): Promise<string | null> => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return memoryStore[key] || null;
  } catch (error) {
    console.error('[SecureStorage] Errore lettura chiave:', key, error);
    return memoryStore[key] || null;
  }
};

const setStorageItem = async (key: string, value: string): Promise<void> => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    } else {
      memoryStore[key] = value;
    }
  } catch (error) {
    console.error('[SecureStorage] Errore scrittura chiave:', key, error);
    memoryStore[key] = value;
  }
};

const removeStorageItem = async (key: string): Promise<void> => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    } else {
      delete memoryStore[key];
    }
  } catch (error) {
    console.error('[SecureStorage] Errore rimozione chiave:', key, error);
    delete memoryStore[key];
  }
};

// Stato in memoria (RAM) per tracciare lo sblocco della sessione corrente.
// Viene azzerato ogni volta che l'applicazione viene riavviata.
let sessionUnlocked = false;

export const SecureStorage = {
  // Rileva se è presente una password configurata sul dispositivo (senza sbloccare la sessione)
  async hasMasterPassword(): Promise<boolean> {
    const pwd = await getStorageItem(STORAGE_KEYS.MASTER_PASSWORD);
    return pwd !== null && pwd.trim() !== '';
  },

  isSessionUnlocked(): boolean {
    return sessionUnlocked;
  },

  setSessionUnlocked(unlocked: boolean) {
    sessionUnlocked = unlocked;
  },

  async saveMasterPassword(password: string): Promise<void> {
    await setStorageItem(STORAGE_KEYS.MASTER_PASSWORD, password);
    // Se l'utente imposta o cambia la password, sblocchiamo la sessione corrente automaticamente
    sessionUnlocked = true;
  },

  async getMasterPassword(): Promise<string | null> {
    // Restituisce la password solo se la sessione corrente è stata sbloccata tramite l'AuthGuard
    if (!sessionUnlocked) return null;
    return await getStorageItem(STORAGE_KEYS.MASTER_PASSWORD);
  },

  // Metodo interno per verificare la password inserita nell'AuthGuard
  async verifyPassword(password: string): Promise<boolean> {
    const saved = await getStorageItem(STORAGE_KEYS.MASTER_PASSWORD);
    return saved === password;
  },

  async saveCloudConfig(config: CloudConfig): Promise<void> {
    await setStorageItem(STORAGE_KEYS.CLOUD_CONFIG, JSON.stringify(config));
  },

  async getCloudConfig(): Promise<CloudConfig | null> {
    const data = await getStorageItem(STORAGE_KEYS.CLOUD_CONFIG);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  async saveAIConfig(config: AIConfig): Promise<void> {
    await setStorageItem(STORAGE_KEYS.AI_CONFIG, JSON.stringify(config));
  },

  async getAIConfig(): Promise<AIConfig | null> {
    const data = await getStorageItem(STORAGE_KEYS.AI_CONFIG);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  async clearAll(): Promise<void> {
    sessionUnlocked = false;
    await removeStorageItem(STORAGE_KEYS.MASTER_PASSWORD);
    await removeStorageItem(STORAGE_KEYS.CLOUD_CONFIG);
    await removeStorageItem(STORAGE_KEYS.AI_CONFIG);
  }
};

