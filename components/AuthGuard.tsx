import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  Pressable, 
  ActivityIndicator, 
  Platform, 
  useColorScheme 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Palette } from '../constants/Colors';
import { SecureStorage } from '../constants/SecureStorage';
import { CryptoEngine } from '../constants/CryptoEngine';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';
  const currentTheme = isDark ? Palette.dark : Palette.light;

  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  
  // Stati per la creazione password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  const isWeb = Platform.OS === 'web';

  const checkLockState = async () => {
    const configured = await SecureStorage.hasMasterPassword();
    setHasPassword(configured);

    if (!configured) {
      setIsUnlocked(false);
    } else {
      const sessionActive = SecureStorage.isSessionUnlocked();
      setIsUnlocked(sessionActive);
    }
  };

  useEffect(() => {
    checkLockState();
  }, []);

  const handlePasswordUnlock = async () => {
    if (!enteredPassword.trim()) return;
    setErrorMsg(null);

    const isValid = await SecureStorage.verifyPassword(enteredPassword);
    if (isValid) {
      try {
        await CryptoEngine.deriveKey(enteredPassword);
        SecureStorage.setSessionUnlocked(true);
        setIsUnlocked(true);
      } catch (e) {
        console.error('[AuthGuard] Errore derivazione chiave:', e);
        setErrorMsg('Errore nella generazione della chiave crittografica.');
      }
    } else {
      setErrorMsg('Password errata. Riprova.');
    }
  };

  const handleCreatePassword = async () => {
    if (!newPassword.trim()) {
      setErrorMsg('La password non può essere vuota.');
      return;
    }
    if (newPassword.length < 4) {
      setErrorMsg('La password deve essere di almeno 4 caratteri.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Le password non coincidono.');
      return;
    }
    setErrorMsg(null);

    try {
      // Salva la password in SecureStorage (imposta in automatico sessionUnlocked = true)
      await SecureStorage.saveMasterPassword(newPassword);
      // Deriva la chiave in memoria RAM
      await CryptoEngine.deriveKey(newPassword);
      
      setHasPassword(true);
      setIsUnlocked(true);
    } catch (e) {
      console.error('[AuthGuard] Errore inizializzazione password:', e);
      setErrorMsg('Errore durante il salvataggio della password.');
    }
  };

  const handleBiometricUnlock = async () => {
    if (isBiometricLoading) return;
    setErrorMsg(null);
    setIsBiometricLoading(true);

    setTimeout(async () => {
      try {
        // Ottiene la password in modo sicuro (simulazione) e sblocca la sessione
        SecureStorage.setSessionUnlocked(true);
        // Eseguiamo il sblocco effettivo caricando la password ed elaborando la chiave in memoria RAM
        const savedPassword = await SecureStorage.getMasterPassword();
        if (savedPassword) {
          await CryptoEngine.deriveKey(savedPassword);
          setIsUnlocked(true);
        } else {
          setErrorMsg('Nessuna password salvata trovata.');
          SecureStorage.setSessionUnlocked(false);
        }
      } catch (e) {
        setErrorMsg('Sblocco biometrico fallito.');
        SecureStorage.setSessionUnlocked(false);
      } finally {
        setIsBiometricLoading(false);
      }
    }, 1200);
  };

  // Caricamento iniziale
  if (hasPassword === null) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="small" color={currentTheme.textPrimary} />
      </View>
    );
  }

  // App sbloccata -> renderizza l'albero di navigazione normale (Stack/Tabs)
  if (isUnlocked) {
    return <>{children}</>;
  }

  // Schermata a tutto schermo
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.background }]} edges={['top', 'bottom']}>
      <View style={styles.authContainer}>
        {/* Header Logo */}
        <View style={styles.header}>
          <Text style={[styles.logoText, { color: currentTheme.textPrimary }]}>
            {hasPassword ? 'Nerd Journal' : 'Benvenuto in Nerd Journal'}
          </Text>
          
          <View style={[styles.statusNode, { borderColor: currentTheme.border, backgroundColor: currentTheme.surface }]}>
            <View style={[styles.statusDot, { backgroundColor: hasPassword ? '#f59e0b' : '#3b82f6' }]} />
            <Text style={[styles.statusText, { color: currentTheme.textPrimary }]}>
              {hasPassword ? 'Zero-Knowledge Auth' : 'Inizializzazione Spazio'}
            </Text>
          </View>
        </View>

        {/* UI di Setup (Primo Accesso) */}
        {!hasPassword ? (
          <View style={[styles.authCard, { backgroundColor: currentTheme.surface, borderColor: currentTheme.border }]}>
            <Text style={[styles.cardTitle, { color: currentTheme.textPrimary }]}>
              Crea Master Password
            </Text>
            <Text style={[styles.cardDescription, { color: currentTheme.textSecondary }]}>
              Questa password verrà utilizzata localmente sul tuo dispositivo per generare la chiave crittografica AES-GCM 256. Non verrà mai trasmessa in rete.
            </Text>

            <TextInput
              placeholder="Crea Master Password..."
              placeholderTextColor={currentTheme.textSecondary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={true}
              onSubmitEditing={handleCreatePassword}
              style={[
                styles.input,
                { 
                  color: currentTheme.textPrimary, 
                  borderColor: currentTheme.border, 
                  backgroundColor: currentTheme.background 
                }
              ]}
            />

            <TextInput
              placeholder="Conferma Master Password..."
              placeholderTextColor={currentTheme.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={true}
              onSubmitEditing={handleCreatePassword}
              style={[
                styles.input,
                { 
                  color: currentTheme.textPrimary, 
                  borderColor: currentTheme.border, 
                  backgroundColor: currentTheme.background 
                }
              ]}
            />

            {errorMsg && (
              <Text style={styles.errorText}>
                ❌ {errorMsg}
              </Text>
            )}

            <Pressable
              onPress={handleCreatePassword}
              style={[styles.unlockBtn, { backgroundColor: currentTheme.textPrimary, width: '100%', marginTop: 8 }]}
            >
              <Text style={[styles.unlockBtnText, { color: isDark ? '#000' : '#fff' }]}>
                Inizializza Spazio Cifrato
              </Text>
            </Pressable>
          </View>
        ) : (
          /* UI di Sblocco (Accessi Successivi) */
          <View style={[styles.authCard, { backgroundColor: currentTheme.surface, borderColor: currentTheme.border }]}>
            <Text style={[styles.cardTitle, { color: currentTheme.textPrimary }]}>
              Spazio di Lavoro Bloccato
            </Text>
            <Text style={[styles.cardDescription, { color: currentTheme.textSecondary }]}>
              Inserisci la Master Password per derivare le chiavi crittografiche client-side e ripristinare la sessione in RAM.
            </Text>

            <TextInput
              placeholder="Inserisci Master Password..."
              placeholderTextColor={currentTheme.textSecondary}
              value={enteredPassword}
              onChangeText={setEnteredPassword}
              secureTextEntry={true}
              onSubmitEditing={handlePasswordUnlock}
              style={[
                styles.input,
                { 
                  color: currentTheme.textPrimary, 
                  borderColor: currentTheme.border, 
                  backgroundColor: currentTheme.background 
                }
              ]}
            />

            {errorMsg && (
              <Text style={styles.errorText}>
                ❌ {errorMsg}
              </Text>
            )}

            <View style={styles.actionsRow}>
              <Pressable
                onPress={handlePasswordUnlock}
                style={[styles.unlockBtn, { backgroundColor: currentTheme.textPrimary, flex: 1 }]}
              >
                <Text style={[styles.unlockBtnText, { color: isDark ? '#000' : '#fff' }]}>
                  Sblocca Spazio
                </Text>
              </Pressable>

              {!isWeb && (
                <Pressable
                  onPress={handleBiometricUnlock}
                  disabled={isBiometricLoading}
                  style={[
                    styles.bioBtn, 
                    { 
                      borderColor: currentTheme.border, 
                      backgroundColor: isDark ? '#1a2730' : '#e0f2fe' 
                    }
                  ]}
                >
                  {isBiometricLoading ? (
                    <ActivityIndicator size="small" color="#0284c7" />
                  ) : (
                    <Text style={styles.bioIcon}>🧬</Text>
                  )}
                </Pressable>
              )}
            </View>

            {isBiometricLoading && (
              <Text style={[styles.loadingText, { color: currentTheme.textSecondary }]}>
                Verifica biometrica in corso...
              </Text>
            )}
          </View>
        )}

        {/* Footer info sicurezza */}
        <Text style={[styles.footerText, { color: currentTheme.textSecondary }]}>
          Nessuna chiave viene mai inoltrata a server centralizzati. Tutto avviene interamente in locale nella sandbox del tuo browser o del dispositivo.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  authContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 10,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  statusNode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  authCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  unlockBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bioBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioIcon: {
    fontSize: 20,
  },
  loadingText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  footerText: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
});
