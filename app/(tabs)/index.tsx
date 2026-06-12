import React, { useState, useCallback } from 'react';
import {
  FlatList, Pressable, StyleSheet, View,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Link }          from 'expo-router';
import { useNotes }                 from '../../src/notes/NotesContext';
import { NoteCard }                 from '../../src/components/NoteCard';
import { NerdLogo }                 from '../../src/components/NerdLogo';
import { StatsStrip }               from '../../src/components/StatsStrip';
import { AskModal }                 from '../../src/components/AskModal';
import { DesktopPanel }             from '../../src/components/DesktopPanel';
import { Box }                      from '../../src/design/components/Box';
import { T }                        from '../../src/design/components/T';
import { Colors, Spacing }          from '../../src/design/tokens';
import { isTauri }                  from '../../src/platform/detect';
import { useKeyboardShortcuts }     from '../../src/hooks/useKeyboardShortcuts';
import type { Note }                from '../../src/notes/Note';

const IS_DESKTOP = isTauri();

export default function HomeScreen() {
  const { notes, isLoading, createNote } = useNotes();
  const router = useRouter();
  const [askVisible, setAskVisible] = useState(false);

  const handleNew = useCallback(async () => {
    const note = await createNote({ title: '', content: '' });
    if (note) router.push({ pathname: '/note/[id]', params: { id: note.id } });
  }, [createNote, router]);

  const handleAsk  = useCallback(() => setAskVisible(true),  []);
  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, [router]);

  useKeyboardShortcuts({ onNewNote: handleNew, onAsk: handleAsk, onBack: handleBack });

  function handleOpen(note: Note) {
    router.push({ pathname: '/note/[id]', params: { id: note.id } });
  }

  const noteList = (
    <>
      {/* ── Header ───────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <NerdLogo size="md" tagline="personal knowledge base" showDot />
        </View>
        <View style={styles.headerRight}>
          <T variant="caption" style={styles.noteCount}>
            {notes.length} {notes.length === 1 ? 'entry' : 'entries'}
          </T>
          <Link href="/brain" asChild>
            <Pressable testID="brain-btn" accessibilityLabel="Second Brain" style={styles.settingsBtn}>
              <T variant="kicker" style={styles.brainBtn}>BRAIN</T>
            </Pressable>
          </Link>
          <Link href="/settings" asChild>
            <Pressable testID="settings-btn" accessibilityLabel="Settings" style={styles.settingsBtn}>
              <T variant="kicker">SET</T>
            </Pressable>
          </Link>
        </View>
      </View>

      {/* ── Rule + Stats ─────────────────────────────────────── */}
      <View style={styles.rule} />
      {!isLoading && <StatsStrip notes={notes} />}

      {/* ── List ─────────────────────────────────────────────── */}
      {isLoading ? (
        <ActivityIndicator color={Colors.green} style={styles.loader} />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <NoteCard note={item} onPress={() => handleOpen(item)} />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <T variant="kicker" style={styles.emptyKicker}>{'// empty'}</T>
              <T variant="muted" style={styles.emptyHint}>
                {IS_DESKTOP
                  ? 'Press Cmd+N to write your first entry. Tip: configure AI in Settings to auto-tag notes.'
                  : 'Tap + to write your first entry. Tip: configure AI in Settings to auto-tag notes.'}
              </T>
            </View>
          }
        />
      )}
    </>
  );

  const desktopPlaceholder = (
    <View style={styles.desktopPlaceholder}>
      <T variant="kicker" style={styles.placeholderLabel}>{'// select an entry'}</T>
      <T variant="muted" style={styles.placeholderHint}>
        Choose an entry from the list, or press Cmd+N to write a new one.
      </T>
    </View>
  );

  return (
    <Box screen style={styles.root}>
      {IS_DESKTOP ? (
        <DesktopPanel sidebar={noteList} main={desktopPlaceholder} />
      ) : (
        noteList
      )}

      {/* FAB (mobile only) */}
      {!IS_DESKTOP && (
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={handleNew}
          accessibilityLabel="New note"
          testID="fab-new"
        >
          <T style={styles.fabLabel}>+</T>
        </Pressable>
      )}

      {/* Desktop new note button */}
      {IS_DESKTOP && (
        <Pressable
          style={styles.desktopNew}
          onPress={handleNew}
          testID="fab-new"
          accessibilityLabel="New note"
        >
          <T variant="kicker" style={styles.desktopNewLabel}>+ NEW  ⌘N</T>
        </Pressable>
      )}

      <AskModal visible={askVisible} onClose={() => setAskVisible(false)} />
    </Box>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    paddingHorizontal: Spacing.md,
    paddingTop:        Spacing.xl,
    paddingBottom:     Spacing.md,
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'flex-end',
    zIndex:            3,
  },
  headerLeft:  { flex: 1 },
  headerRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.md,
  },
  noteCount: { color: Colors.textMuted },
  askBtn: {
    borderWidth:       1,
    borderColor:       Colors.greenMute,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   4,
  },
  settingsBtn: {
    borderWidth:       1,
    borderColor:       Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   4,
  },
  brainBtn: { color: Colors.green },

  rule: {
    height:          1,
    backgroundColor: Colors.border,
    zIndex:          3,
  },

  loader: { flex: 1, zIndex: 3 },
  list:   { padding: Spacing.md, flexGrow: 1, zIndex: 3 },

  emptyWrap:   { marginTop: Spacing.xxl, alignItems: 'center', gap: Spacing.sm },
  emptyKicker: { marginBottom: Spacing.xs },
  emptyHint:   { textAlign: 'center' },

  desktopPlaceholder: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing.sm,
    padding:        Spacing.xl,
  },
  placeholderLabel: { color: Colors.textMuted },
  placeholderHint:  { color: Colors.textMuted, textAlign: 'center' },

  fab: {
    position:        'absolute',
    bottom:          Spacing.xl,
    right:           Spacing.xl,
    width:           56,
    height:          56,
    backgroundColor: Colors.green,
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    0,
    zIndex:          10,
    shadowColor:     Colors.green,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.6,
    shadowRadius:    16,
    elevation:       8,
    // @ts-ignore — web-only property (replaces deprecated shadow* props on web)
    boxShadow:       `0 0 16px 0 ${Colors.green}99`,
  },
  fabPressed: { opacity: 0.75 },
  fabLabel: {
    color:      Colors.textInverse,
    fontSize:   32,
    lineHeight: 36,
    fontWeight: '800',
  },

  desktopNew: {
    position:        'absolute',
    bottom:          Spacing.md,
    left:            Spacing.md,
    borderWidth:     1,
    borderColor:     Colors.green,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    zIndex:          10,
  },
  desktopNewLabel: { color: Colors.green },
});
