import { getStreak, getSparklineData, getTotalWords } from '../noteStats';
import type { Note } from '../../notes/Note';

function makeNote(overrides: Partial<Note> & { createdAt: number }): Note {
  return {
    id:          'n',
    title:       '',
    content:     '',
    attachments: [],
    updatedAt:   overrides.createdAt,
    ...overrides,
  };
}

// Helper: build a date N days ago as unix ms
function daysAgo(n: number): number {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0); // noon — avoids midnight edge cases
  return d.getTime();
}

describe('getStreak', () => {
  it('returns 0 for empty notes', () => {
    expect(getStreak([])).toBe(0);
  });

  it('returns 1 when only today has a note', () => {
    const notes = [makeNote({ createdAt: daysAgo(0) })];
    expect(getStreak(notes)).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    const notes = [
      makeNote({ createdAt: daysAgo(0) }),
      makeNote({ createdAt: daysAgo(1) }),
      makeNote({ createdAt: daysAgo(2) }),
    ];
    expect(getStreak(notes)).toBe(3);
  });

  it('breaks at a gap in days', () => {
    const notes = [
      makeNote({ createdAt: daysAgo(0) }),
      makeNote({ createdAt: daysAgo(1) }),
      // gap on day 2
      makeNote({ createdAt: daysAgo(3) }),
    ];
    expect(getStreak(notes)).toBe(2);
  });

  it('grants grace period: counts from yesterday when today has no note', () => {
    const notes = [
      makeNote({ createdAt: daysAgo(1) }),
      makeNote({ createdAt: daysAgo(2) }),
    ];
    // No note today — streak counts from yesterday
    expect(getStreak(notes)).toBe(2);
  });

  it('returns 0 when most recent note is 2+ days ago', () => {
    const notes = [
      makeNote({ createdAt: daysAgo(2) }),
      makeNote({ createdAt: daysAgo(3) }),
    ];
    expect(getStreak(notes)).toBe(0);
  });

  it('deduplicates multiple notes on the same day', () => {
    const today = daysAgo(0);
    const notes = [
      makeNote({ id: 'a', createdAt: today }),
      makeNote({ id: 'b', createdAt: today }),
      makeNote({ id: 'c', createdAt: today + 3600_000 }), // 1h later, same day
    ];
    expect(getStreak(notes)).toBe(1);
  });
});

describe('getSparklineData', () => {
  it('returns exactly `days` entries', () => {
    const result = getSparklineData([], 14);
    expect(result).toHaveLength(14);
  });

  it('all counts are 0 for empty notes', () => {
    const result = getSparklineData([], 14);
    expect(result.every((d) => d.count === 0)).toBe(true);
  });

  it('counts note created today', () => {
    const notes  = [makeNote({ createdAt: daysAgo(0) })];
    const result = getSparklineData(notes, 14);
    const today  = result[result.length - 1]!;
    expect(today.count).toBe(1);
  });

  it('counts multiple notes on the same day', () => {
    const notes = [
      makeNote({ id: 'a', createdAt: daysAgo(0) }),
      makeNote({ id: 'b', createdAt: daysAgo(0) + 1000 }),
    ];
    const result = getSparklineData(notes, 14);
    const today  = result[result.length - 1]!;
    expect(today.count).toBe(2);
  });

  it('ignores notes older than the window', () => {
    const notes  = [makeNote({ createdAt: daysAgo(100) })];
    const result = getSparklineData(notes, 14);
    expect(result.every((d) => d.count === 0)).toBe(true);
  });

  it('entries are ordered oldest → newest', () => {
    const result = getSparklineData([], 7);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.date >= result[i - 1]!.date).toBe(true);
    }
  });
});

describe('getTotalWords', () => {
  it('returns 0 for empty notes', () => {
    expect(getTotalWords([])).toBe(0);
  });

  it('counts words in title and content', () => {
    const notes = [makeNote({ createdAt: daysAgo(0), title: 'Hello world', content: 'This is a test.' })];
    // "Hello world This is a test." = 6 words
    expect(getTotalWords(notes)).toBe(6);
  });

  it('sums words across multiple notes', () => {
    const notes = [
      makeNote({ id: 'a', createdAt: daysAgo(0), title: 'One', content: 'two three' }),
      makeNote({ id: 'b', createdAt: daysAgo(1), title: '',    content: 'four five' }),
    ];
    expect(getTotalWords(notes)).toBe(5);
  });

  it('handles blank notes gracefully', () => {
    const notes = [makeNote({ createdAt: daysAgo(0), title: '', content: '' })];
    expect(getTotalWords(notes)).toBe(0);
  });
});
