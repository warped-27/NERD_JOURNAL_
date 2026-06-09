import { getDailyPrompt } from '../dailyPrompt';

describe('getDailyPrompt', () => {
  it('returns a non-empty string', () => {
    expect(getDailyPrompt().length).toBeGreaterThan(0);
  });

  it('is deterministic for the same date', () => {
    const date = new Date('2026-03-15');
    expect(getDailyPrompt(date)).toBe(getDailyPrompt(date));
  });

  it('returns different prompts on different days', () => {
    // Compare a spread of days to confirm rotation
    const prompts = Array.from({ length: 10 }, (_, i) => {
      const d = new Date('2026-01-01');
      d.setDate(d.getDate() + i);
      return getDailyPrompt(d);
    });
    const unique = new Set(prompts);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('cycles without throwing for all days in a year', () => {
    const start = new Date('2026-01-01');
    expect(() => {
      for (let i = 0; i < 365; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        getDailyPrompt(d);
      }
    }).not.toThrow();
  });

  it('returns the same prompt on the same calendar day each year (day-of-year stable)', () => {
    // Day 0 (Jan 1) in different years
    const y1 = getDailyPrompt(new Date('2026-01-01'));
    const y2 = getDailyPrompt(new Date('2027-01-01'));
    expect(y1).toBe(y2);
  });
});
