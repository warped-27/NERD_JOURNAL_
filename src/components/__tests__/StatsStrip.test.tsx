import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';
import { StatsStrip } from '../StatsStrip';
import type { Note } from '../../notes/Note';

jest.mock('react-native', () => ({
  Platform:   { OS: 'web' },
  View:       'View',
  Text:       'Text',
  StyleSheet: { create: (s: object) => s, flatten: (s: unknown) => s },
}));

jest.mock('../../design/components/T',   () => ({ T: 'Text' }));
jest.mock('../../design/tokens',         () => ({
  Colors:  { green: '#1cff9b', textMuted: '#4a564f', border: '#1a2520' },
  Spacing: { xs: 4, sm: 8, md: 16 },
}));

// Sparkline is tested separately — stub it out
jest.mock('../Sparkline', () => ({ Sparkline: () => null }));

// dailyPrompt returns a deterministic string; no need to mock
jest.mock('../../stats/dailyPrompt', () => ({
  getDailyPrompt: () => 'Test prompt text',
}));

function note(id: string, createdAt: number): Note {
  return { id, title: 'T', content: 'body', attachments: [], createdAt, updatedAt: createdAt };
}

const NOW = Date.now();

describe('StatsStrip', () => {
  it('renders the daily prompt', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<StatsStrip notes={[]} />);
    });
    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain('Test prompt text');
  });

  it('renders daily-prompt testID', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<StatsStrip notes={[]} />);
    });
    expect(renderer.root.findByProps({ testID: 'daily-prompt' })).toBeTruthy();
  });

  it('does not render stats row when notes is empty', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<StatsStrip notes={[]} />);
    });
    // stats-strip exists but no streak text
    const json = JSON.stringify(renderer.toJSON());
    expect(json).not.toContain('STREAK');
  });

  it('renders streak when notes exist', () => {
    const notes = [note('a', NOW)];
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<StatsStrip notes={notes} />);
    });
    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain('STREAK');
  });

  it('shows NO STREAK when streak is 0', () => {
    // A note from 5 days ago with a gap — streak is 0
    const old = NOW - 5 * 86_400_000;
    const notes = [note('a', old)];
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<StatsStrip notes={notes} />);
    });
    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain('NO STREAK');
  });

  it('renders testID stats-strip', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<StatsStrip notes={[]} />);
    });
    expect(renderer.root.findByProps({ testID: 'stats-strip' })).toBeTruthy();
  });
});
