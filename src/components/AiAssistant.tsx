import React, { useState } from 'react';
import { View, TextInput, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useAi } from '../ai/AiContext';
import { T } from '../design/components/T';
import { Btn } from '../design/components/Btn';
import { Colors, Spacing, Typography } from '../design/tokens';
import { PrivacyConsentDialog } from './PrivacyConsentDialog';

interface Props {
  noteContent: string;
}

export function AiAssistant({ noteContent }: Props) {
  const ai = useAi();
  const [instruction, setInstruction] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    if (!instruction.trim()) return;
    setError(null);
    setResponse(null);

    const result = await ai.requestWithConsent(noteContent, instruction.trim());
    if (result.ok) {
      setResponse(result.value);
    } else {
      setError(result.error.message);
    }
  }

  if (!ai.hasAnyProvider) {
    return (
      <View style={styles.root} testID="ai-no-key">
        <T variant="muted">No AI provider configured.</T>
        <T variant="muted">Add an API key or enable a local provider in Settings.</T>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="ai-assistant">
      <PrivacyConsentDialog
        visible={ai.pendingConsent}
        providerName={ai.cloudProviderName ?? 'Cloud AI'}
        onAccept={ai.giveConsent}
        onDecline={ai.declineConsent}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={instruction}
          onChangeText={setInstruction}
          placeholder="Ask AI about this note…"
          placeholderTextColor={Colors.textMuted}
          returnKeyType="send"
          onSubmitEditing={handleAsk}
          testID="ai-input"
          editable={!ai.isLoading}
        />
        <Btn
          variant="primary"
          label={ai.isLoading ? '…' : 'ASK'}
          onPress={handleAsk}
          loading={ai.isLoading}
          testID="ai-ask-btn"
          style={styles.askBtn}
        />
      </View>

      {error && (
        <T variant="error" style={styles.result} testID="ai-error">
          {error}
        </T>
      )}

      {response && (
        <ScrollView style={styles.responseScroll} testID="ai-response">
          <T variant="body" style={styles.result}>
            {response}
          </T>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop:     Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingBottom:  Spacing.md,
    gap:            Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap:           Spacing.sm,
    alignItems:    'center',
  },
  input: {
    flex:            1,
    fontFamily:      Typography.fontFamily,
    fontSize:        13,
    color:           Colors.green,
    backgroundColor: Colors.bgInput,
    borderWidth:     1,
    borderColor:     Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   Spacing.xs,
    borderRadius:    0,
  },
  askBtn:        { width: 60 },
  result:        { marginTop: Spacing.xs },
  responseScroll:{ maxHeight: 160 },
});
