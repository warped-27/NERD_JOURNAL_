import React, { useState } from 'react';
import {
  View, KeyboardAvoidingView, ScrollView,
  StyleSheet, Platform,
} from 'react-native';
import { useVault } from '../crypto/VaultContext';
import { T }   from '../design/components/T';
import { Box } from '../design/components/Box';
import { Input } from '../design/components/Input';
import { Btn } from '../design/components/Btn';
import { Colors, Spacing } from '../design/tokens';

interface Props {
  children: React.ReactNode;
}

export function AuthGuard({ children }: Props) {
  const vault = useVault();

  // Not yet checked whether vault exists
  if (vault.isInitialised === null) return null;

  // First run — create the vault
  if (!vault.isInitialised) return <SetupScreen />;

  // Vault exists but key not in RAM
  if (!vault.isUnlocked) return <UnlockScreen />;

  // Key in RAM — render protected content
  return <>{children}</>;
}

// ---------- Setup screen ----------

function SetupScreen() {
  const vault = useVault();
  const [password, setPassword]   = useState('');
  const [confirm,  setConfirm]    = useState('');
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState('');

  async function handleCreate() {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    const result = await vault.create(password);
    setLoading(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <Shell title="INITIALISE VAULT">
      <T variant="muted" style={styles.hint}>
        Choose a master password. It will be used to encrypt all your notes.
        You cannot recover it if lost.
      </T>

      <Input
        value={password}
        onChangeText={setPassword}
        placeholder="master password"
        secureTextEntry
        autoFocus
        style={styles.input}
        hasError={!!error}
        testID="input-password"
      />
      <Input
        value={confirm}
        onChangeText={setConfirm}
        placeholder="confirm password"
        secureTextEntry
        style={styles.input}
        hasError={!!error}
        testID="input-confirm"
      />

      {error ? <T variant="error">{error}</T> : null}

      <Btn
        label="CREATE VAULT"
        onPress={handleCreate}
        loading={loading}
        style={styles.btn}
      />
    </Shell>
  );
}

// ---------- Unlock screen ----------

function UnlockScreen() {
  const vault = useVault();
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleUnlock() {
    if (!password) return;
    setError('');
    setLoading(true);
    const result = await vault.unlock(password);
    setLoading(false);
    if (!result.ok) setError('Wrong password.');
  }

  return (
    <Shell title="UNLOCK VAULT">
      <T variant="muted" style={styles.hint}>
        Enter your master password to decrypt your journal.
      </T>

      <Input
        value={password}
        onChangeText={setPassword}
        placeholder="master password"
        secureTextEntry
        autoFocus
        onSubmitEditing={handleUnlock}
        style={styles.input}
        hasError={!!error}
        testID="input-password"
      />

      {error ? <T variant="error">{error}</T> : null}

      <Btn
        label="UNLOCK"
        onPress={handleUnlock}
        loading={loading}
        style={styles.btn}
      />
    </Shell>
  );
}

// ---------- Shell ----------

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <T variant="title" style={styles.title}>{title}</T>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Box>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1 },
  kav:   { flex: 1 },
  scroll: {
    flexGrow:       1,
    justifyContent: 'center',
    padding:        Spacing.xl,
  },
  title: { marginBottom: Spacing.xl },
  hint:  { marginBottom: Spacing.lg },
  input: { marginBottom: Spacing.md },
  btn:   { marginTop: Spacing.md },
});
