import { tokenize, rankByRelevance } from '../tfidf';

describe('tokenize', () => {
  it('lowercases and splits on non-alpha', () => {
    expect(tokenize('Hello, World!')).toEqual(['hello', 'world']);
  });

  it('removes stop words', () => {
    const tokens = tokenize('the quick brown fox');
    expect(tokens).not.toContain('the');
    expect(tokens).toContain('quick');
  });

  it('removes tokens shorter than 3 chars', () => {
    const tokens = tokenize('I do it');
    expect(tokens.every((t) => t.length > 2)).toBe(true);
  });

  it('returns empty array for blank text', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('rankByRelevance', () => {
  it('returns empty array for zero docs', () => {
    expect(rankByRelevance('anything', [])).toEqual([]);
  });

  it('returns array same length as docs', () => {
    const docs = ['alpha beta', 'gamma delta', 'epsilon zeta'];
    expect(rankByRelevance('alpha', docs)).toHaveLength(3);
  });

  it('all scores are in [0, 1]', () => {
    const docs = ['foo bar baz', 'qux quux corge'];
    const scores = rankByRelevance('foo bar', docs);
    for (const s of scores) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('matching doc scores higher than unrelated doc', () => {
    const docs = [
      'machine learning neural network deep learning',
      'cooking recipe pasta carbonara dinner',
    ];
    const scores = rankByRelevance('deep learning neural network', docs);
    expect(scores[0]).toBeGreaterThan(scores[1]!);
  });

  it('gives score 0 when query has no overlap with any doc', () => {
    const docs = ['apple orange banana', 'grape lemon lime'];
    const scores = rankByRelevance('zzz yyy xxx', docs);
    expect(scores.every((s) => s === 0)).toBe(true);
  });

  it('identical query and doc produces highest possible score', () => {
    const docs = ['unique special keyword', 'something else entirely'];
    const scores = rankByRelevance('unique special keyword', docs);
    expect(scores[0]).toBeGreaterThan(scores[1]!);
    expect(scores[0]).toBeCloseTo(1, 1);
  });

  it('returns all-zero scores when query is all stop words', () => {
    const scores = rankByRelevance('the a an', ['foo bar', 'baz qux']);
    expect(scores.every((s) => s === 0)).toBe(true);
  });

  it('returns all-zero scores when all docs are empty strings', () => {
    const scores = rankByRelevance('something', ['', '', '']);
    expect(scores.every((s) => s === 0)).toBe(true);
  });

  it('never produces NaN or Infinity', () => {
    const cases = [
      { q: '', docs: ['foo'] },
      { q: 'the', docs: [''] },
      { q: 'x'.repeat(500), docs: ['y'.repeat(500), ''] },
    ];
    for (const { q, docs } of cases) {
      const scores = rankByRelevance(q, docs);
      for (const s of scores) {
        expect(Number.isFinite(s)).toBe(true);
      }
    }
  });
});
