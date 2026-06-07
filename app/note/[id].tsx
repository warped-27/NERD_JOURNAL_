import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNotes } from '../../src/notes/NotesContext';
import { useAi } from '../../src/ai/AiContext';
import { enrichNote } from '../../src/ai/enrichNote';
import { NoteEditor } from '../../src/components/NoteEditor';
import { Box } from '../../src/design/components/Box';
import { T }   from '../../src/design/components/T';
import { Colors, Spacing } from '../../src/design/tokens';
import type { Note } from '../../src/notes/Note';

export default function NoteScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const router   = useRouter();
  const { notes, updateNote, patchNote, deleteNote } = useNotes();
  const ai = useAi();

  const note = notes.find((n) => n.id === id);

  // Snapshot initial values so edits don't flicker on re-render
  const [initial] = useState<Pick<Note, 'title' | 'content' | 'attachments' | 'tags' | 'summary' | 'palette'>>({
    title:       note?.title       ?? '',
    content:     note?.content     ?? '',
    attachments: note?.attachments ?? [],
    tags:        note?.tags,
    summary:     note?.summary,
    palette:     note?.palette,
  });

  // Track intentional deletion so the useEffect doesn't double-navigate
  const deletingRef = useRef(false);

  // If note disappears (deleted here or from elsewhere), go home safely
  useEffect(() => {
    if (id && !note && !deletingRef.current) {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }
  }, [note, id]);

  async function handleSave(patch: Pick<Note, 'title' | 'content'> & { attachments?: Note['attachments'] }) {
    if (!id) return;
    await updateNote(id, patch);
    // Fire enrichment asynchronously — does not block navigation
    if (ai.apiKey && ai.hasConsented && (patch.title || patch.content)) {
      enrichNote(patch.title, patch.content, ai.apiKey, ai.model).then((result) => {
        if (result.ok) void patchNote(id, result.value);
      });
    }
    router.back();
  }

  async function handleDelete() {
    if (!id) return;
    deletingRef.current = true;
    await deleteNote(id);
    // Let the useEffect navigate once the store update propagates
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <Box style={styles.root}>
      {/* Nav bar */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <T variant="label">← BACK</T>
        </Pressable>
      </View>

      <NoteEditor
        initialTitle={initial.title}
        initialContent={initial.content}
        initialAttachments={initial.attachments}
        initialTags={initial.tags}
        initialSummary={initial.summary}
        initialPalette={initial.palette}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </Box>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    paddingHorizontal: Spacing.md,
    paddingTop:        Spacing.xl,
    paddingBottom:     Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { alignSelf: 'flex-start' },
});
