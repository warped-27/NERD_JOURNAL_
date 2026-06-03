import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  Pressable, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  useColorScheme,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Palette } from '../../constants/Colors';
import { SecureStorage, CloudConfig, AIConfig } from '../../constants/SecureStorage';

// Abilita la chiusura della sessione per flussi basati su browser/Web
WebBrowser.maybeCompleteAuthSession();

// Helper per estrarre l'access_token dal frammento url restituito da Google
const extractTokenFromUrl = (url: string): string | null => {
  const hashPart = url.split('#')[1] || url.split('?')[1];
  if (!hashPart) return null;
  const params = hashPart.split('&');
  for (const param of params) {
    const [key, value] = param.split('=');
    if (key === 'access_token') {
      return decodeURIComponent(value);
    }
  }
  return null;
};

export default function SettingsScreen() {
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';
  const currentTheme = isDark ? Palette.dark : Palette.light;



  // Stato Cloud Config
  const [cloudProvider, setCloudProvider] = useState<CloudConfig['provider']>('none');
  const [webdavUrl, setWebdavUrl] = useState('');
  const [webdavUsername, setWebdavUsername] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');
  
  // Stati Google Drive OAuth
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleAccessToken, setGoogleAccessToken] = useState('');
  const [authStatus, setAuthStatus] = useState<'idle' | 'authorizing' | 'success' | 'error'>('idle');

  // Stato AI Config
  const [aiProvider, setAiProvider] = useState<AIConfig['provider']>('none');
  const [aiApiKey, setAiApiKey] = useState('');
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3');

  // Stato Feedback UI
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Caricamento dei dati salvati all'avvio
  useEffect(() => {
    async function loadSettings() {


      const cloud = await SecureStorage.getCloudConfig();
      if (cloud) {
        setCloudProvider(cloud.provider);
        if (cloud.webdavUrl) setWebdavUrl(cloud.webdavUrl);
        if (cloud.webdavUsername) setWebdavUsername(cloud.webdavUsername);
        if (cloud.webdavPassword) setWebdavPassword(cloud.webdavPassword);
        if (cloud.googleClientId) setGoogleClientId(cloud.googleClientId);
        if (cloud.accessToken) {
          setGoogleAccessToken(cloud.accessToken);
          setAuthStatus('success');
        }
      }

      const ai = await SecureStorage.getAIConfig();
      if (ai) {
        setAiProvider(ai.provider);
        if (ai.apiKey) setAiApiKey(ai.apiKey);
        if (ai.customEndpoint) setOllamaEndpoint(ai.customEndpoint);
        if (ai.modelName) setOllamaModel(ai.modelName);
      }
    }
    loadSettings();
  }, []);

  // Avvia il flusso OAuth 2.0 nativo/Web per Google Drive
  const handleGoogleAuth = async () => {
    if (!googleClientId.trim()) {
      setErrorMsg('Inserisci prima il tuo Google Client ID.');
      return;
    }
    setErrorMsg(null);
    setAuthStatus('authorizing');

    try {
      // Genera il redirect URI per l'applicazione (Web o schema nativo per iOS/Android)
      const redirectUrl = Linking.createURL('oauth-callback');
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
        `client_id=${encodeURIComponent(googleClientId.trim())}&` +
        `redirect_uri=${encodeURIComponent(redirectUrl)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.file')}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type === 'success' && result.url) {
        const token = extractTokenFromUrl(result.url);
        if (token) {
          setGoogleAccessToken(token);
          setAuthStatus('success');
          
          // Salva immediatamente per rendere operativo il CloudSyncEngine
          await SecureStorage.saveCloudConfig({
            provider: 'google_drive',
            googleClientId: googleClientId.trim(),
            accessToken: token,
          });
          
          setSaveStatus('success');
          setTimeout(() => setSaveStatus('idle'), 3000);
        } else {
          setAuthStatus('error');
          setErrorMsg('Impossibile estrarre l\'access token dall\'URL di risposta.');
        }
      } else {
        setAuthStatus('error');
        setErrorMsg('Accesso annullato dall\'utente.');
      }
    } catch (err: any) {
      console.error('[Google OAuth] Errore:', err);
      setAuthStatus('error');
      setErrorMsg(`Errore di connessione: ${err.message || err}`);
    }
  };

  // Rimuove l'Access Token e disconnette Google Drive
  const handleGoogleDisconnect = async () => {
    setGoogleAccessToken('');
    setAuthStatus('idle');
    await SecureStorage.saveCloudConfig({
      provider: 'google_drive',
      googleClientId: googleClientId,
      accessToken: undefined,
    });
    setSaveStatus('success');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setErrorMsg(null);
    try {


      // Salva configurazione cloud
      await SecureStorage.saveCloudConfig({
        provider: cloudProvider,
        webdavUrl: cloudProvider === 'webdav' ? webdavUrl : undefined,
        webdavUsername: cloudProvider === 'webdav' ? webdavUsername : undefined,
        webdavPassword: cloudProvider === 'webdav' ? webdavPassword : undefined,
        googleClientId: cloudProvider === 'google_drive' ? googleClientId : undefined,
        accessToken: cloudProvider === 'google_drive' ? googleAccessToken : undefined,
      });

      // Salva configurazione AI
      await SecureStorage.saveAIConfig({
        provider: aiProvider,
        apiKey: (aiProvider === 'gemini' || aiProvider === 'openai') ? aiApiKey : undefined,
        customEndpoint: aiProvider === 'ollama' ? ollamaEndpoint : undefined,
        modelName: aiProvider === 'ollama' ? ollamaModel : undefined,
      });

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleClear = async () => {
    await SecureStorage.clearAll();

    setCloudProvider('none');
    setWebdavUrl('');
    setWebdavUsername('');
    setWebdavPassword('');
    setGoogleClientId('');
    setGoogleAccessToken('');
    setAuthStatus('idle');
    setAiProvider('none');
    setAiApiKey('');
    setOllamaEndpoint('http://localhost:11434');
    setOllamaModel('llama3');
    setSaveStatus('success');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderColor: currentTheme.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: currentTheme.textPrimary }]}>Impostazioni</Text>
          <Text style={[styles.headerSubtitle, { color: currentTheme.textSecondary }]}>spazio_di_lavoro / configurazione</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          {/* SEZIONE 1: Cloud Storage (BYO-Cloud) */}
          <View style={[styles.card, { backgroundColor: currentTheme.surface, borderColor: currentTheme.border }]}>
            <Text style={[styles.cardTitle, { color: currentTheme.textPrimary }]}>1. Destinazione Cloud (BYO-Cloud)</Text>
            <Text style={[styles.cardDescription, { color: currentTheme.textSecondary }]}>
              Seleziona dove verranno conservati i file JSON cifrati delle tue note.
            </Text>

            {/* Provider Selector Buttons */}
            <View style={styles.selectorGrid}>
              {(['none', 'icloud', 'google_drive', 'webdav'] as const).map((p) => {
                const isSelected = cloudProvider === p;
                const pastelColors: Record<string, string> = {
                  none: isDark ? '#27272a' : '#f4f4f5',
                  icloud: isDark ? '#1a2730' : '#e0f2fe',
                  google_drive: isDark ? '#1b2d24' : '#e8f5e9',
                  webdav: isDark ? '#3d2516' : '#fff3e0',
                };
                
                return (
                  <Pressable
                    key={p}
                    onPress={() => setCloudProvider(p)}
                    style={[
                      styles.selectorBtn,
                      { 
                        borderColor: isSelected ? currentTheme.textPrimary : currentTheme.border,
                        backgroundColor: isSelected ? pastelColors[p] : currentTheme.background
                      }
                    ]}
                  >
                    <Text 
                      style={[
                        styles.selectorBtnText, 
                        { 
                          color: isSelected ? currentTheme.textPrimary : currentTheme.textSecondary,
                          fontWeight: isSelected ? '600' : '400'
                        }
                      ]}
                    >
                      {p === 'none' && 'Nessuno'}
                      {p === 'icloud' && 'iCloud'}
                      {p === 'google_drive' && 'G-Drive'}
                      {p === 'webdav' && 'WebDAV'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* WebDAV Specific Inputs */}
            {cloudProvider === 'webdav' && (
              <View style={styles.conditionalContainer}>
                <Text style={[styles.label, { color: currentTheme.textPrimary }]}>URL Server WebDAV</Text>
                <TextInput
                  placeholder="https://esempio.com/nextcloud/remote.php/dav/"
                  placeholderTextColor={currentTheme.textSecondary}
                  value={webdavUrl}
                  onChangeText={setWebdavUrl}
                  style={[
                    styles.input,
                    { color: currentTheme.textPrimary, borderColor: currentTheme.border, backgroundColor: currentTheme.background }
                  ]}
                />
                
                <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Username</Text>
                <TextInput
                  placeholder="Il tuo username..."
                  placeholderTextColor={currentTheme.textSecondary}
                  value={webdavUsername}
                  onChangeText={setWebdavUsername}
                  style={[
                    styles.input,
                    { color: currentTheme.textPrimary, borderColor: currentTheme.border, backgroundColor: currentTheme.background }
                  ]}
                />

                <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Password / App Password</Text>
                <TextInput
                  placeholder="La tua password WebDAV..."
                  placeholderTextColor={currentTheme.textSecondary}
                  value={webdavPassword}
                  onChangeText={setWebdavPassword}
                  secureTextEntry
                  style={[
                    styles.input,
                    { color: currentTheme.textPrimary, borderColor: currentTheme.border, backgroundColor: currentTheme.background }
                  ]}
                />
              </View>
            )}

            {/* Google Drive Configuration & OAuth */}
            {cloudProvider === 'google_drive' && (
              <View style={styles.conditionalContainer}>
                <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Client ID OAuth Google</Text>
                <TextInput
                  placeholder="Inserisci il tuo Client ID OAuth..."
                  placeholderTextColor={currentTheme.textSecondary}
                  value={googleClientId}
                  onChangeText={setGoogleClientId}
                  style={[
                    styles.input,
                    { color: currentTheme.textPrimary, borderColor: currentTheme.border, backgroundColor: currentTheme.background }
                  ]}
                />

                {/* Badge di stato per l'autorizzazione OAuth */}
                {authStatus === 'authorizing' && (
                  <View style={[styles.authBadge, { backgroundColor: isDark ? '#3d2516' : '#fff3e0', borderColor: '#f59e0b' }]}>
                    <ActivityIndicator size="small" color="#f59e0b" style={{ marginRight: 6 }} />
                    <Text style={[styles.authBadgeText, { color: '#f59e0b' }]}>
                      🔄 Autorizzazione in corso...
                    </Text>
                  </View>
                )}

                {authStatus === 'success' && googleAccessToken ? (
                  <View style={[styles.authBadge, { backgroundColor: isDark ? '#1b2d24' : '#e8f5e9', borderColor: '#10b981' }]}>
                    <Text style={[styles.authBadgeText, { color: '#10b981' }]}>
                      ✔ Connesso a Google Drive
                    </Text>
                  </View>
                ) : null}

                {authStatus === 'error' && (
                  <View style={[styles.authBadge, { backgroundColor: isDark ? '#3d1b1b' : '#ffebee', borderColor: '#ef4444' }]}>
                    <Text style={[styles.authBadgeText, { color: '#ef4444' }]}>
                      ⚠️ Connessione fallita
                    </Text>
                  </View>
                )}

                {/* Pulsante di Login/Logout */}
                {googleAccessToken ? (
                  <Pressable
                    onPress={handleGoogleDisconnect}
                    style={[styles.oauthBtn, { borderColor: '#ef4444', backgroundColor: 'transparent', borderWidth: 1 }]}
                  >
                    <Text style={[styles.oauthBtnText, { color: '#ef4444' }]}>
                      Disconnetti Google Drive
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleGoogleAuth}
                    disabled={authStatus === 'authorizing'}
                    style={[styles.oauthBtn, { backgroundColor: currentTheme.textPrimary }]}
                  >
                    <Text style={[styles.oauthBtnText, { color: isDark ? '#000' : '#fff' }]}>
                      Accedi con Google Drive
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {cloudProvider === 'icloud' && (
              <View style={[styles.infoBadge, { backgroundColor: isDark ? '#1a2730' : '#e0f2fe', borderColor: currentTheme.border }]}>
                <Text style={[styles.infoText, { color: isDark ? '#a1a1aa' : '#0284c7' }]}>
                  ✦ iCloud sfrutta il container di sincronizzazione nativo di iOS. Le note verranno salvate localmente nella cartella JournalAI di iCloud Drive del dispositivo.
                </Text>
              </View>
            )}
          </View>

          {/* SEZIONE 2: AI Config (BYOK) */}
          <View style={[styles.card, { backgroundColor: currentTheme.surface, borderColor: currentTheme.border }]}>
            <Text style={[styles.cardTitle, { color: currentTheme.textPrimary }]}>2. Motore IA (Bring Your Own Key)</Text>
            <Text style={[styles.cardDescription, { color: currentTheme.textSecondary }]}>
              Inserisci la tua chiave API o l'endpoint per Ollama locale. Nessuna chiave viene mai inoltrata a server esterni.
            </Text>

            {/* AI Selector Buttons */}
            <View style={styles.selectorGrid}>
              {(['none', 'gemini', 'openai', 'ollama'] as const).map((p) => {
                const isSelected = aiProvider === p;
                const pastelColors: Record<string, string> = {
                  none: isDark ? '#27272a' : '#f4f4f5',
                  gemini: isDark ? '#1a2730' : '#e0f2fe',
                  openai: isDark ? '#212f27' : '#e8f5e9',
                  ollama: isDark ? '#2d1b33' : '#f3e5f5',
                };

                return (
                  <Pressable
                    key={p}
                    onPress={() => setAiProvider(p)}
                    style={[
                      styles.selectorBtn,
                      { 
                        borderColor: isSelected ? currentTheme.textPrimary : currentTheme.border,
                        backgroundColor: isSelected ? pastelColors[p] : currentTheme.background
                      }
                    ]}
                  >
                    <Text 
                      style={[
                        styles.selectorBtnText, 
                        { 
                          color: isSelected ? currentTheme.textPrimary : currentTheme.textSecondary,
                          fontWeight: isSelected ? '600' : '400'
                        }
                      ]}
                    >
                      {p === 'none' && 'Nessuno'}
                      {p === 'gemini' && 'Gemini'}
                      {p === 'openai' && 'OpenAI'}
                      {p === 'ollama' && 'Ollama'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* API Key Inputs */}
            {(aiProvider === 'gemini' || aiProvider === 'openai') && (
              <View style={styles.conditionalContainer}>
                <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Chiave API</Text>
                <TextInput
                  placeholder={`Inserisci la tua API Key di ${aiProvider === 'gemini' ? 'Gemini' : 'OpenAI'}...`}
                  placeholderTextColor={currentTheme.textSecondary}
                  value={aiApiKey}
                  onChangeText={setAiApiKey}
                  secureTextEntry
                  style={[
                    styles.input,
                    { color: currentTheme.textPrimary, borderColor: currentTheme.border, backgroundColor: currentTheme.background }
                  ]}
                />
              </View>
            )}

            {/* Ollama Inputs */}
            {aiProvider === 'ollama' && (
              <View style={styles.conditionalContainer}>
                <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Endpoint Ollama Locale</Text>
                <TextInput
                  placeholder="http://localhost:11434"
                  placeholderTextColor={currentTheme.textSecondary}
                  value={ollamaEndpoint}
                  onChangeText={setOllamaEndpoint}
                  style={[
                    styles.input,
                    { color: currentTheme.textPrimary, borderColor: currentTheme.border, backgroundColor: currentTheme.background }
                  ]}
                />

                <Text style={[styles.label, { color: currentTheme.textPrimary }]}>Nome Modello</Text>
                <TextInput
                  placeholder="llama3 o phi4..."
                  placeholderTextColor={currentTheme.textSecondary}
                  value={ollamaModel}
                  onChangeText={setOllamaModel}
                  style={[
                    styles.input,
                    { color: currentTheme.textPrimary, borderColor: currentTheme.border, backgroundColor: currentTheme.background }
                  ]}
                />
              </View>
            )}
          </View>

          {/* Buttons & Status Indicators */}
          <View style={styles.actionsContainer}>
            {errorMsg && (
              <View style={[styles.statusBanner, { backgroundColor: isDark ? '#3d1b1b' : '#ffebee' }]}>
                <Text style={[styles.statusBannerText, { color: '#ef4444' }]}>
                  ⚠️ {errorMsg}
                </Text>
              </View>
            )}

            {saveStatus === 'success' && (
              <View style={[styles.statusBanner, { backgroundColor: isDark ? '#1b2d24' : '#e8f5e9' }]}>
                <Text style={[styles.statusBannerText, { color: isDark ? '#81c784' : '#2e7d32' }]}>
                  ✔ Configurazione salvata sul dispositivo!
                </Text>
              </View>
            )}

            <Pressable 
              onPress={handleSave}
              disabled={saveStatus === 'saving'}
              style={[
                styles.saveButton, 
                { backgroundColor: currentTheme.textPrimary }
              ]}
            >
              <Text style={[styles.saveButtonText, { color: isDark ? '#000' : '#fff' }]}>
                {saveStatus === 'saving' ? 'Salvataggio...' : 'Salva Configurazione'}
              </Text>
            </Pressable>

            <Pressable 
              onPress={handleClear}
              style={[styles.clearButton, { borderColor: currentTheme.border }]}
            >
              <Text style={[styles.clearButtonText, { color: currentTheme.textSecondary }]}>
                Azzera Credenziali Locali
              </Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  inputToggle: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  selectorGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  selectorBtn: {
    flex: 1,
    minWidth: '45%',
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorBtnText: {
    fontSize: 13,
  },
  conditionalContainer: {
    marginTop: 12,
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
  },
  infoBadge: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  infoText: {
    fontSize: 11,
    lineHeight: 15,
  },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  authBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  oauthBtn: {
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  oauthBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionsContainer: {
    marginTop: 10,
    gap: 12,
  },
  statusBanner: {
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  statusBannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  clearButton: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
});


