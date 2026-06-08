import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { T }   from '../design/components/T';
import { Box } from '../design/components/Box';
import { Colors, Spacing, BorderWidth } from '../design/tokens';
import type { Note } from '../notes/Note';
import { contentSnippet } from '../notes/noteSearch';

const PREVIEW_LENGTH = 100;

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-CA'); // YYYY-MM-DD
}

interface Props {
  note:         Note;
  onPress:      () => void;
  searchQuery?: string;
}

export function NoteCard({ note, onPress, searchQuery }: Props) {
  const accentColor = note.palette?.[0] ?? Colors.border;

  const preview = searchQuery
    ? contentSnippet(note.content, searchQuery)
    : note.summary
      ? note.summary.replace(/\n/g, '  ')
      : note.content.length > PREVIEW_LENGTH
        ? note.content.slice(0, PREVIEW_LENGTH) + '…'
        : note.content;

  return (
    <Pressable testID="note-card" onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Box surface style={[styles.card, { borderColor: accentColor }]}>
        <T variant="heading" style={styles.title} numberOfLines={1}>{note.title || '(no title)'}</T>

        {preview ? (
          <T variant="muted" style={styles.preview} numberOfLines={2}>{preview}</T>
        ) : null}

        {note.tags && note.tags.length > 0 && (
          <View style={styles.tags}>
            {note.tags.slice(0, 4).map((tag) => (
              <T key={tag} variant="caption" style={[styles.tag, { borderColor: accentColor, color: accentColor }]}>
                #{tag}
              </T>
            ))}
          </View>
        )}

        <T variant="caption" style={styles.date}>{formatDate(note.updatedAt)}</T>
      </Box>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth:   BorderWidth.normal,
    borderColor:   Colors.border,
    padding:       Spacing.md,
    marginBottom:  Spacing.sm,
  },
  title:   { marginBottom: Spacing.xs },
  preview: { marginBottom: Spacing.xs },
  tags: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            Spacing.xs,
    marginBottom:   Spacing.xs,
  },
  tag: {
    borderWidth:       1,
    paddingHorizontal: Spacing.xs,
    paddingVertical:   2,
    fontSize:          10,
  },
  date:    {},
  pressed: { opacity: 0.7 },
});
