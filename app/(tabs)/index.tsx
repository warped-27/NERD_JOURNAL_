import React from 'react';
import { FlatList, Pressable, StyleSheet, View, ActivityIndicator } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useNotes }      from '../../src/notes/NotesContext';
import { NoteCard }      from '../../src/components/NoteCard';
import { NerdLogo }      from '../../src/components/NerdLogo';
import { Box }           from '../../src/design/components/Box';
import { T }             from '../../src/design/components/T';
import { Colors, Spacing } from '../../src/design/tokens';
import type { Note }     from '../../src/notes/Note';

export default function HomeScreen() {
  const { notes, isLoading, createNote } = useNotes();
  const router = useRouter();

  async function handleNew() {
    const note = await createNote({ title: '', content: '' });
    if (note) router.push({ pathname: '/note/[id]', params: { id: note.id } });
  }

  function handleOpen(note: Note) {
    router.push({ pathname: '/note/[id]', params: { id: note.id } });
  }

  return (
    <Box screen style={styles.root}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <NerdLogo size="md" tagline="personal knowledge base" showDot />
        </View>

        <View style={styles.headerRight}>
          <T variant="caption" style={styles.noteCount}>
            {notes.length} {notes.length === 1 ? 'entry' : 'entries'}
          </T>
          <Link href="/settings" asChild>
            <Pressable testID="settings-btn" accessibilityLabel="Settings" style={styles.settingsBtn}>
              <T variant="kicker">CFG</T>
            </Pressable>
          </Link>
        </View>
      </View>

      {/* ── Rule ─────────────────────────────────────────────────── */}
      <View style={styles.rule} />

      {/* ── List ─────────────────────────────────────────────────── */}
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
              <T variant="kicker" style={styles.emptyKicker}>// no entries</T>
              <T variant="muted" style={styles.emptyHint}>
                Press + to write your first log.
              </T>
            </View>
          }
        />
      )}

      {/* ── FAB ──────────────────────────────────────────────────── */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={handleNew}
        accessibilityLabel="New note"
        testID="fab-new"
      >
        <T style={styles.fabLabel}>+</T>
      </Pressable>
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
  settingsBtn: {
    borderWidth:  1,
    borderColor:  Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   4,
  },

  rule: {
    height:          1,
    backgroundColor: Colors.border,
    marginBottom:    0,
    zIndex:          3,
  },

  loader: { flex: 1, zIndex: 3 },
  list:   { padding: Spacing.md, flexGrow: 1, zIndex: 3 },

  emptyWrap:   { marginTop: Spacing.xxl, alignItems: 'center', gap: Spacing.sm },
  emptyKicker: { marginBottom: Spacing.xs },
  emptyHint:   { textAlign: 'center' },

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
    // glow
    shadowColor:     Colors.green,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.6,
    shadowRadius:    16,
    elevation:       8,
  },
  fabPressed: { opacity: 0.75 },
  fabLabel: {
    color:      Colors.textInverse,
    fontSize:   32,
    lineHeight: 36,
    fontWeight: '800',
  },
});
