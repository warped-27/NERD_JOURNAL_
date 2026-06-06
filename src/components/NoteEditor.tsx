import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { T }     from '../design/components/T';
import { Box }   from '../design/components/Box';
import { Input } from '../design/components/Input';
import { Btn }   from '../design/components/Btn';
import { AiAssistant } from './AiAssistant';
import { Colors, Spacing } from '../design/tokens';
import type { Note } from '../notes/Note';

interface Props {
  initialTitle:   string;
  initialContent: string;
  onSave:   (patch: Pick<Note, 'title' | 'content'>) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function NoteEditor({ initialTitle, initialContent, onSave, onDelete }: Props) {
  const [title,   setTitle]   = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await onSave({ title: title.trim(), content });
    } catch {
      setError('Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (onDelete) await onDelete();
  }

  return (
    <Box style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="title"
          style={styles.titleInput}
          testID="editor-title"
        />

        <Input
          value={content}
          onChangeText={setContent}
          placeholder="start writing…"
          multiline
          style={styles.contentInput}
          textAlignVertical="top"
          testID="editor-content"
        />

        {error ? <T variant="error" style={styles.error}>{error}</T> : null}

        <View style={styles.actions}>
          <Btn
            label="SAVE"
            onPress={handleSave}
            loading={saving}
            style={styles.saveBtn}
            testID="save-btn"
          />
          {onDelete && (
            <Btn
              label="DELETE"
              variant="danger"
              onPress={handleDelete}
              style={styles.deleteBtn}
              testID="delete-btn"
            />
          )}
        </View>
      </ScrollView>

      <AiAssistant noteContent={content} />
    </Box>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { flexGrow: 1, padding: Spacing.md },

  titleInput: {
    fontSize:     20,
    marginBottom: Spacing.md,
    borderColor:  Colors.greenMute,
  },
  contentInput: {
    flex:         1,
    minHeight:    300,
    marginBottom: Spacing.md,
    borderColor:  Colors.greenMute,
  },
  error:     { marginBottom: Spacing.sm },
  actions:   { flexDirection: 'row', gap: Spacing.sm },
  saveBtn:   { flex: 1 },
  deleteBtn: { flex: 1 },
});
