import React, { useState, useEffect } from 'react';
import {
  View, Modal, ScrollView, StyleSheet,
  Pressable, TextInput,
} from 'react-native';
import { useRouter }   from 'expo-router';
import { T }           from '../design/components/T';
import { Btn }         from '../design/components/Btn';
import { Colors, Spacing, Typography } from '../design/tokens';
import { useAi }       from '../ai/AiContext';
import { useNotes }    from '../notes/NotesContext';
import { buildAskPrompt, getRelevantNotes } from '../ai/askNotes';
import type { Note } from '../notes/Note';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function AskModal({ visible, onClose }: Props) {
  const [question, setQuestion] = useState('');
  const [answer,   setAnswer]   = useState('');
  const [sources,  setSources]  = useState<Note[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const ai         = useAi();
  const { notes }  = useNotes();
  const router     = useRouter();

  useEffect(() => {
    if (visible) {
      setQuestion('');
      setAnswer('');
      setSources([]);
      setError('');
    }
  }, [visible]);

  async function handleAsk() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setAnswer('');
    setSources([]);
    setError('');
    try {
      const relevant = getRelevantNotes(q, notes, 5);
      const pool     = relevant.length > 0 ? relevant : notes.slice(0, 5);
      const prompt   = buildAskPrompt(q, pool);
      const result   = await ai.doComplete(prompt);
      if (result.ok) {
        setAnswer(result.value.trim());
        setSources(relevant);
      } else {
        setError(result.error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleOpenNote(note: Note) {
    handleClose();
    router.push({ pathname: '/note/[id]', params: { id: note.id } });
  }

  function handleClose() {
    setQuestion('');
    setAnswer('');
    setSources([]);
    setError('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent testID="ask-modal">
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            <T variant="kicker" style={styles.headerTitle}>// ASK YOUR NOTES</T>
            <Pressable onPress={handleClose} testID="ask-close">
              <T variant="muted">✕</T>
            </Pressable>
          </View>

          {/* Question input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={question}
              onChangeText={setQuestion}
              placeholder="ask anything about your notes…"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="send"
              onSubmitEditing={handleAsk}
              autoCapitalize="none"
              autoCorrect={false}
              testID="ask-input"
            />
            <Btn
              label="ASK"
              onPress={handleAsk}
              loading={loading}
              style={styles.askBtn}
              testID="ask-submit"
            />
          </View>

          {/* Response area */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {error ? (
              <T variant="error">{error}</T>
            ) : answer ? (
              <>
                <View style={styles.rule} />
                <T variant="muted" style={styles.answer}>{answer}</T>

                {sources.length > 0 && (
                  <>
                    <T variant="label" style={styles.sourcesLabel}>// SOURCES</T>
                    {sources.map((n, i) => (
                      <Pressable
                        key={n.id}
                        style={styles.sourceCard}
                        onPress={() => handleOpenNote(n)}
                        testID={`ask-source-${i}`}
                      >
                        <T variant="kicker" style={styles.sourceTitle} numberOfLines={1}>
                          {n.title || '(untitled)'}
                        </T>
                        <T variant="muted" style={styles.sourceSnippet} numberOfLines={2}>
                          {n.content}
                        </T>
                      </Pressable>
                    ))}
                  </>
                )}
              </>
            ) : null}
          </ScrollView>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    justifyContent:  'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: Colors.bgSurface,
    borderTopWidth:  1,
    borderTopColor:  Colors.border,
    maxHeight:       '80%',
    paddingHorizontal: Spacing.md,
    paddingTop:      Spacing.md,
    paddingBottom:   Spacing.xl,
    gap:             Spacing.sm,
  },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  headerTitle: { color: Colors.green },

  inputRow: {
    flexDirection: 'row',
    gap:           Spacing.xs,
    alignItems:    'center',
  },
  input: {
    flex:              1,
    fontFamily:        Typography.fontFamily,
    fontSize:          13,
    color:             Colors.green,
    borderWidth:       1,
    borderColor:       Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   Spacing.xs,
    backgroundColor:   Colors.bgInput,
  },
  askBtn: { width: 64, flex: 0 },

  body:        { flex: 1 },
  bodyContent: { paddingVertical: Spacing.sm, gap: Spacing.sm },

  rule:   { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  answer: { lineHeight: 20 },

  sourcesLabel: { color: Colors.textMuted, marginTop: Spacing.sm },
  sourceCard: {
    borderWidth:  1,
    borderColor:  Colors.border,
    padding:      Spacing.sm,
    gap:          2,
  },
  sourceTitle:   { color: Colors.green },
  sourceSnippet: { lineHeight: 16 },
});
