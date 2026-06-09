import type { Note } from '../notes/Note';

export interface SparkDay {
  date:  string;   // YYYY-MM-DD
  count: number;
}

function toDateKey(tsMs: number): string {
  const d = new Date(tsMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Consecutive-day writing streak.
 * Counts backward from today; if today has no entry yet the count starts from
 * yesterday (grace period — you have until midnight to maintain your streak).
 */
export function getStreak(notes: Note[]): number {
  if (!notes.length) return 0;
  const days = new Set(notes.map((n) => toDateKey(n.createdAt)));
  const now  = new Date();
  const todayKey = toDateKey(now.getTime());

  // Start from today if there's an entry today, otherwise from yesterday
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(todayKey)) d.setDate(d.getDate() - 1);

  let streak = 0;
  while (days.has(toDateKey(d.getTime()))) {
    streak++;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  }
  return streak;
}

/**
 * Notes-per-day for the last `days` calendar days (default 14), ordered oldest → newest.
 * Days with no entry are included with count 0 so the sparkline always has a fixed width.
 */
export function getSparklineData(notes: Note[], days = 14): SparkDay[] {
  const counts = new Map<string, number>();
  const now    = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    counts.set(toDateKey(d.getTime()), 0);
  }
  for (const note of notes) {
    const key = toDateKey(note.createdAt);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
}

/** Rough total word count across all note titles + content. */
export function getTotalWords(notes: Note[]): number {
  return notes.reduce((sum, n) => {
    const text = `${n.title} ${n.content}`.trim();
    return text ? sum + text.split(/\s+/).length : sum;
  }, 0);
}
