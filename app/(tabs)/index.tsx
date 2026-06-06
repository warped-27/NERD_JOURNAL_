import React from 'react';
import { FlatList, Pressable, StyleSheet, View, ActivityIndicator } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useNotes } from '../../src/notes/NotesContext';
import { NoteCard } from '../../src/components/NoteCard';
import { Box }  from '../../src/design/components/Box';
import { T }    from '../../src/design/components/T';
import { Colors, Spacing } from '../../src/design/tokens';
import type { Note } from '../../src/notes/Note';

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
    <Box style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <T variant="title">NERD JOURNAL</T>
        <Link href="/settings" asChild>
          <Pressable testID="settings-btn" accessibilityLabel="Settings">
            <T variant="label" style={styles.settingsIcon}>⚙</T>
          </Pressable>
        </Link>
      </View>

      {/* List */}
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
            <T variant="muted" style={styles.empty}>
              No entries yet.{'\n'}Press + to create one.
            </T>
          }
        />
      )}

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={handleNew}
        accessibilityLabel="New note"
        testID="fab-new"
      >
        <T variant="heading" style={styles.fabLabel}>+</T>
      </Pressable>
    </Box>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop:        Spacing.xl,
    paddingBottom:     Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
  },
  settingsIcon: { fontSize: 20 },
  loader: { flex: 1 },
  list:   { padding: Spacing.md, flexGrow: 1 },
  empty:  { textAlign: 'center', marginTop: Spacing.xxl },
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
  },
  fabPressed: { opacity: 0.7 },
  fabLabel:   { color: Colors.textInverse, fontSize: 32, lineHeight: 36 },
});
