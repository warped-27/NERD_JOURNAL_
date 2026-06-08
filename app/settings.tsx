import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAi, GEMINI_MODELS } from '../src/ai/AiContext';
import { Box } from '../src/design/components/Box';
import { T } from '../src/design/components/T';
import { Input } from '../src/design/components/Input';
import { Btn } from '../src/design/components/Btn';
import { Colors, Spacing } from '../src/design/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const ai = useAi();
  const [key,   setKey]   = useState(ai.apiKey ?? '');
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
    <Box screen style={styles.root}>
      {/* Nav */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="settings-back">
          <T variant="kicker">← back</T>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ─── API KEY ─── */}
        <T variant="heading" style={styles.section}>AI SETTINGS</T>

        <T variant="label" style={styles.label}>GEMINI API KEY</T>
        <T variant="muted" style={styles.hint}>
          Stored only on this device. Get a free key at aistudio.google.com
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
            Key configured: ••••••••
          </T>
        )}

        {/* ─── AUTO-ENRICH ─── */}
        <T variant="label" style={[styles.label, styles.modelTitle]}>AUTO-ENRICH NOTES</T>
        <T variant="muted" style={styles.hint}>
          When enabled, notes are automatically tagged and summarised by AI after each save.
          Your note content is sent to Gemini. Requires consent and a configured API key.
        </T>
        <Pressable
          style={[styles.toggleRow, ai.autoEnrich && styles.toggleRowActive]}
          onPress={() => ai.setAutoEnrich(!ai.autoEnrich)}
          accessibilityRole="switch"
          accessibilityState={{ checked: ai.autoEnrich }}
          testID="settings-autoenrich"
        >
          <View style={[styles.radio, ai.autoEnrich && styles.radioActive]} />
          <T variant={ai.autoEnrich ? 'label' : 'muted'} style={styles.modelLabel}>
            {ai.autoEnrich ? 'ENABLED' : 'DISABLED'}
          </T>
        </Pressable>

        {/* ─── MODEL ─── */}
        <T variant="label" style={[styles.label, styles.modelTitle]}>AI MODEL</T>
        <T variant="muted" style={styles.hint}>
          Flash Lite is free-tier and fastest. Flash is more capable.
        </T>

        {GEMINI_MODELS.map((m) => {
          const active = ai.model === m.id;
          return (
            <Pressable
              key={m.id}
              style={[styles.modelRow, active && styles.modelRowActive]}
              onPress={() => ai.setModel(m.id)}
              testID={`model-${m.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.radio, active && styles.radioActive]} />
              <T variant={active ? 'label' : 'muted'} style={styles.modelLabel}>
                {m.label}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
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
  backBtn:    { alignSelf: 'flex-start' },
  content:    { padding: Spacing.md, paddingBottom: Spacing.xxl },
  section:    { marginBottom: Spacing.lg },
  label:      { marginBottom: Spacing.xs },
  hint:       { marginBottom: Spacing.md, lineHeight: 18 },
  input:      { marginBottom: Spacing.md },
  actions:    { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  btn:        { flex: 1 },
  status:     { marginTop: Spacing.xs },
  modelTitle: { marginTop: Spacing.lg },
  modelRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderWidth:    1,
    borderColor:    Colors.border,
    marginBottom:   Spacing.xs,
    gap:            Spacing.sm,
  },
  modelRowActive: { borderColor: Colors.green, backgroundColor: Colors.greenBg },
  toggleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderWidth:    1,
    borderColor:    Colors.border,
    marginBottom:   Spacing.md,
    gap:            Spacing.sm,
  },
  toggleRowActive: { borderColor: Colors.green, backgroundColor: Colors.greenBg },
  radio: {
    width:        12,
    height:       12,
    borderRadius: 0,
    borderWidth:  1,
    borderColor:  Colors.greenDim,
  },
  radioActive: { backgroundColor: Colors.green, borderColor: Colors.green },
  modelLabel: { flex: 1 },
});
