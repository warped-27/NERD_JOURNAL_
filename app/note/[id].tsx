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
import { noteToMarkdown } from '../../src/export/markdownExport';
import { saveTextFile }   from '../../src/platform/fileSystem';

export default function NoteScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const router   = useRouter();
  const { notes, updateNote, patchNote, deleteNote } = useNotes();
  const ai = useAi();

  const note = notes.find((n) => n.id === id);

  function handleOpenNote(target: Note) {
    router.push({ pathname: '/note/[id]', params: { id: target.id } });
  }

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
  }, [note, id, router]);

  // Tracks in-flight enrichment so a stale result doesn't overwrite a re-edit
  const enrichAbortRef = useRef<{ aborted: boolean } | null>(null);

  async function handleSave(patch: Pick<Note, 'title' | 'content'> & { attachments?: Note['attachments'] }) {
    if (!id) return;
    // Cancel any pending enrichment from a previous save
    if (enrichAbortRef.current) enrichAbortRef.current.aborted = true;
    try {
      await updateNote(id, patch);
    } catch (e) {
      // updateNote failure is surfaced by NoteEditor's onSave error handler
      throw e;
    }
    if (ai.hasAnyProvider && ai.autoEnrich && (patch.title || patch.content)) {
      const token = { aborted: false };
      enrichAbortRef.current = token;
      enrichNote(patch.title, patch.content, ai.doComplete).then((result) => {
        if (!token.aborted && result.ok) void patchNote(id, result.value);
      });
    }
    router.back();
  }

  async function handleDelete() {
    if (!id) return;
    try {
      deletingRef.current = true;
      await deleteNote(id);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch {
      deletingRef.current = false;
    }
  }

  return (
    <Box screen style={styles.root}>
      {/* Nav bar */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <T variant="kicker">← back</T>
        </Pressable>
        {note && (
          <Pressable
            onPress={() => saveTextFile(noteToMarkdown(note), `${note.title || 'note'}.md`).catch(() => {})}
            style={styles.mdBtn}
            testID="note-export-md"
          >
            <T variant="kicker" style={styles.mdBtnText}>MD</T>
          </Pressable>
        )}
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
        currentNote={note}
        allNotes={notes}
        onOpenNote={handleOpenNote}
      />
    </Box>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop:        Spacing.xl,
    paddingBottom:     Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn:    { alignSelf: 'flex-start' },
  mdBtn: {
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  mdBtnText:  { color: Colors.textMuted },
});
