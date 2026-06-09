import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import type { Note } from '../notes/Note';
import { getStreak, getSparklineData, getTotalWords } from '../stats/noteStats';
import { getDailyPrompt } from '../stats/dailyPrompt';
import { Sparkline } from './Sparkline';
import { T } from '../design/components/T';
import { Colors, Spacing } from '../design/tokens';

interface Props {
  notes: Note[];
}

function fmt(n: number): string {
  return n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);
}

export function StatsStrip({ notes }: Props) {
  const streak  = useMemo(() => getStreak(notes),                  [notes]);
  const spark   = useMemo(() => getSparklineData(notes, 14),       [notes]);
  const words   = useMemo(() => getTotalWords(notes),              [notes]);
  const prompt  = useMemo(() => getDailyPrompt(),                  []);

  return (
    <View testID="stats-strip">
      {/* ── Stats row ──────────────────────────────────────────── */}
      {notes.length > 0 && (
        <View style={styles.statsRow}>
          <T variant="kicker" style={styles.streakLabel}>
            {streak > 0 ? `${streak}D STREAK` : 'NO STREAK'}
          </T>
          <Sparkline data={spark} />
          <T variant="caption" style={styles.wordCount}>
            {fmt(words)} WDS
          </T>
        </View>
      )}

      {/* ── Rule ───────────────────────────────────────────────── */}
      <View style={styles.rule} />

      {/* ── Daily prompt ───────────────────────────────────────── */}
      <View style={styles.promptRow} testID="daily-prompt">
        <T variant="kicker" style={styles.promptLabel}>// PROMPT</T>
        <T variant="muted"  style={styles.promptText}>{prompt}</T>
      </View>

      {/* ── Rule ───────────────────────────────────────────────── */}
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.xs,
    backgroundColor:   'transparent',
  },
  streakLabel: {
    color:      Colors.green,
    minWidth:   80,
  },
  wordCount: {
    color:    Colors.textMuted,
    marginLeft: 'auto',
  },

  rule: {
    height:          1,
    backgroundColor: Colors.border,
  },

  promptRow: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
  },
  promptLabel: {
    color:      Colors.textMuted,
    marginTop:  2,
    flexShrink: 0,
  },
  promptText: {
    flex:       1,
    lineHeight: 18,
  },
});
