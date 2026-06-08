import { searchNotes, contentSnippet } from '../noteSearch';
import type { Note } from '../Note';

function makeNote(partial: Partial<Note>): Note {
  return {
    id:          partial.id          ?? 'id1',
    title:       partial.title       ?? '',
    content:     partial.content     ?? '',
    attachments: partial.attachments ?? [],
    createdAt:   partial.createdAt   ?? 0,
    updatedAt:   partial.updatedAt   ?? 0,
    tags:        partial.tags,
    summary:     partial.summary,
    palette:     partial.palette,
  };
}

const notes: Note[] = [
  makeNote({ id: 'a', title: 'Meeting notes',  content: 'Discussed quarterly budget review' }),
  makeNote({ id: 'b', title: 'Rust learning',  content: 'Read about ownership and borrowing' }),
  makeNote({ id: 'c', title: 'Shopping list',  content: 'Milk, eggs, bread, butter', tags: ['shopping', 'errands'] }),
  makeNote({ id: 'd', title: 'AI research',    content: 'Neural networks and deep learning', summary: 'Notes on AI' }),
  makeNote({ id: 'e', title: 'budget tracker', content: 'Monthly expenses overview' }),
];

describe('searchNotes', () => {
  it('returns all notes with score 0 for empty query', () => {
    const results = searchNotes(notes, '');
    expect(results).toHaveLength(notes.length);
    results.forEach((r) => expect(r.score).toBe(0));
  });

  it('returns all notes with score 0 for whitespace query', () => {
    expect(searchNotes(notes, '   ')).toHaveLength(notes.length);
  });

  it('finds notes by title match', () => {
    const results = searchNotes(notes, 'rust');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].note.id).toBe('b');
  });

  it('finds notes by content match', () => {
    const results = searchNotes(notes, 'ownership');
    expect(results.length).toBe(1);
    expect(results[0].note.id).toBe('b');
  });

  it('finds notes by tag match', () => {
    const results = searchNotes(notes, 'shopping');
    expect(results.some((r) => r.note.id === 'c')).toBe(true);
  });

  it('finds notes by summary match', () => {
    const results = searchNotes(notes, 'Notes on AI');
    expect(results.some((r) => r.note.id === 'd')).toBe(true);
  });

  it('scores title matches higher than content-only matches', () => {
    const results = searchNotes(notes, 'budget');
    const titleMatch   = results.find((r) => r.note.id === 'e')!; // "budget tracker" in title
    const contentMatch = results.find((r) => r.note.id === 'a')!; // "budget" in content
    expect(titleMatch.score).toBeGreaterThan(contentMatch.score);
  });

  it('is case-insensitive', () => {
    expect(searchNotes(notes, 'RUST')).toHaveLength(1);
    expect(searchNotes(notes, 'rust')).toHaveLength(1);
  });

  it('returns results sorted by score descending', () => {
    const results = searchNotes(notes, 'budget');
    const scores = results.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('excludes non-matching notes', () => {
    const results = searchNotes(notes, 'quantum');
    expect(results).toHaveLength(0);
  });

  it('reports contentMatch index', () => {
    const results = searchNotes(notes, 'ownership');
    expect(results[0].contentMatch).toBeGreaterThanOrEqual(0);
  });
});

describe('contentSnippet', () => {
  const content = 'The quick brown fox jumps over the lazy dog. The fox is very quick.';

  it('returns beginning of content for empty query', () => {
    expect(contentSnippet(content, '')).toBe(content.slice(0, 120));
  });

  it('returns snippet around match', () => {
    const snippet = contentSnippet(content, 'lazy');
    expect(snippet).toContain('lazy');
  });

  it('adds ellipsis when snippet is not at start', () => {
    const long = 'A'.repeat(50) + 'target' + 'B'.repeat(50);
    const snippet = contentSnippet(long, 'target');
    expect(snippet.startsWith('…')).toBe(true);
  });

  it('returns beginning slice when no match', () => {
    const snippet = contentSnippet(content, 'zzz');
    expect(snippet).toBe(content.slice(0, 120));
  });
});
