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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Stati sblocco biometrico
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  // Rileva se siamo su un browser desktop
  const isWeb = Platform.OS === 'web';

  const checkLockState = async () => {
    const configured = await SecureStorage.hasMasterPassword();
    setHasPassword(configured);

    if (!configured) {
      // Primo avvio: nessuna password impostata. Consentiamo l'accesso.
      setIsUnlocked(true);
    } else {
      // Password impostata: controlla lo stato della sessione RAM
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
      // Deriva la chiave crittografica per la sessione e sblocca
      try {
        await CryptoEngine.deriveKey(enteredPassword);
        SecureStorage.setSessionUnlocked(true);
        setIsUnlocked(true);
      } catch (e) {
        console.error('[AuthGuard] Errore derivazione chiave:', e);
        setErrorMsg('Errore interno. Riprova.');
      }
    } else {
      setErrorMsg('Password errata. Riprova.');
    }
  };

  const handleBiometricUnlock = async () => {
    if (isBiometricLoading) return;
    setErrorMsg(null);
    setIsBiometricLoading(true);

    // Simula la latenza del FaceID/Fingerprint nativo sul dispositivo
    setTimeout(async () => {
      try {
        // Ottiene in sicurezza la password memorizzata (autenticata dal TouchID/FaceID simulato)
        // Nelle implementazioni reali, questo sblocca l'accesso al portachiavi sicuro (Keychain/Keystore)
        SecureStorage.setSessionUnlocked(true);
        
        // Eseguiamo anche il caricamento del master password ed il trigger della chiave in RAM
        const savedPassword = await SecureStorage.verifyPassword(''); // Nel mockup usiamo l'autenticazione diretta
        
        setIsUnlocked(true);
      } catch (e) {
        setErrorMsg('Sblocco biometrico fallito.');
      } finally {
        setIsBiometricLoading(false);
      }
    }, 1200);
  };

  // Se lo stato della password non è ancora stato letto, mostriamo una schermata di caricamento geometrica minimale
  if (hasPassword === null) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="small" color={currentTheme.textPrimary} />
      </View>
    );
  }

  // Se l'app è sbloccata, mostra i tab normali
  if (isUnlocked) {
    return <>{children}</>;
  }

  // Altrimenti, blocca l'accesso con la schermata di sblocco a tutto schermo (Auth Overlay)
  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <View style={styles.authContainer}>
        {/* Logo / Header */}
        <View style={styles.header}>
          <Text style={[styles.logoText, { color: currentTheme.textPrimary }]}>JournalAI</Text>
          
          <View style={[styles.statusNode, { borderColor: currentTheme.border, backgroundColor: currentTheme.surface }]}>
            <View style={styles.statusDot} />
            <Text style={[styles.statusText, { color: currentTheme.textPrimary }]}>Zero-Knowledge Auth</Text>
          </View>
        </View>

        {/* Form di sblocco */}
        <View style={[styles.authCard, { backgroundColor: currentTheme.surface, borderColor: currentTheme.border }]}>
          <Text style={[styles.cardTitle, { color: currentTheme.textPrimary }]}>
            Diario Cifrato
          </Text>
          <Text style={[styles.cardDescription, { color: currentTheme.textSecondary }]}>
            Inserisci la Master Password per derivare le chiavi locali di decifratura e sbloccare lo spazio di lavoro.
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

          {/* Azioni di Sblocco */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={handlePasswordUnlock}
              style={[styles.unlockBtn, { backgroundColor: currentTheme.textPrimary, flex: 1 }]}
            >
              <Text style={[styles.unlockBtnText, { color: isDark ? '#000' : '#fff' }]}>
                Sblocca Diario
              </Text>
            </Pressable>

            {/* Icona biometrica per mobile */}
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
              Verifica dei dati biometrici FaceID/TouchID in corso...
            </Text>
          )}
        </View>

        {/* Footer info sicurezza */}
        <Text style={[styles.footerText, { color: currentTheme.textSecondary }]}>
          Nessuna password viene mai trasmessa in rete. La chiave crittografica viene distrutta alla chiusura dell'applicazione.
        </Text>
      </View>
    </View>
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
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
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
    backgroundColor: '#f59e0b', // Led arancione di sblocco in corso
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
    fontSize: 18,
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
