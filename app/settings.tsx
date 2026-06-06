import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAi } from '../src/ai/AiContext';
import { Box } from '../src/design/components/Box';
import { T } from '../src/design/components/T';
import { Input } from '../src/design/components/Input';
import { Btn } from '../src/design/components/Btn';
import { Colors, Spacing } from '../src/design/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const ai = useAi();
  const [key, setKey] = useState(ai.apiKey ?? '');
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    await ai.setApiKey(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClear() {
    await ai.clearApiKey();
    setKey('');
  }

  return (
    <Box style={styles.root}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="settings-back">
          <T variant="label">← BACK</T>
        </Pressable>
      </View>

      <View style={styles.content}>
        <T variant="heading" style={styles.section}>AI SETTINGS</T>

        <T variant="label" style={styles.label}>GEMINI API KEY</T>
        <T variant="muted" style={styles.hint}>
          Your key is stored locally on this device only (never sent to our servers).
          Get a free key at aistudio.google.com
        </T>

        <Input
          value={key}
          onChangeText={setKey}
          placeholder="AIza…"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          testID="settings-apikey"
        />

        <View style={styles.actions}>
          <Btn
            label={saved ? 'SAVED ✓' : 'SAVE KEY'}
            variant="primary"
            onPress={handleSave}
            style={styles.btn}
            testID="settings-save"
          />
          {ai.apiKey && (
            <Btn
              label="CLEAR KEY"
              variant="danger"
              onPress={handleClear}
              style={styles.btn}
              testID="settings-clear"
            />
          )}
        </View>

        {ai.apiKey && (
          <T variant="muted" style={styles.status} testID="settings-key-status">
            Key configured: {ai.apiKey.slice(0, 8)}…
          </T>
        )}
      </View>
    </Box>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  nav: {
    paddingHorizontal: Spacing.md,
    paddingTop:        Spacing.xl,
    paddingBottom:     Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn:  { alignSelf: 'flex-start' },
  content:  { padding: Spacing.md },
  section:  { marginBottom: Spacing.lg },
  label:    { marginBottom: Spacing.xs },
  hint:     { marginBottom: Spacing.md, lineHeight: 18 },
  input:    { marginBottom: Spacing.md },
  actions:  { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  btn:      { flex: 1 },
  status:   { marginTop: Spacing.xs },
});
