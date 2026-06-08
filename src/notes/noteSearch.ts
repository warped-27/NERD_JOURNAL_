import type { Note } from './Note';

export interface SearchResult {
  note:  Note;
  score: number;
  /** Indices of the first match in title and content, used for highlight hints */
  titleMatch:   number; // -1 if no match
  contentMatch: number; // -1 if no match
}

/**
 * In-memory full-text search over decrypted notes.
 * Searches title, content, tags, and summary.
 * Returns results sorted by relevance score (highest first).
 */
export function searchNotes(notes: Note[], rawQuery: string): SearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return notes.map((note) => ({ note, score: 0, titleMatch: -1, contentMatch: -1 }));

  const results: SearchResult[] = [];

  for (const note of notes) {
    const title   = (note.title   ?? '').toLowerCase();
    const content = (note.content ?? '').toLowerCase();
    const summary = (note.summary ?? '').toLowerCase();
    const tags    = (note.tags    ?? []).map((t) => t.toLowerCase());

    let score = 0;

    // Title: weighted highest — exact substring
    const titleIdx = title.indexOf(query);
    if (titleIdx !== -1) {
      score += 10;
      // Bonus for match at word boundary
      if (titleIdx === 0 || title[titleIdx - 1] === ' ') score += 5;
    }

    // Content: count occurrences
    let contentIdx = -1;
    let pos = 0;
    let first = true;
    while ((pos = content.indexOf(query, pos)) !== -1) {
      if (first) { contentIdx = pos; first = false; }
      score += 2;
      pos += query.length;
    }

    // Tags: exact match on individual tags
    for (const tag of tags) {
      if (tag.includes(query)) score += 4;
    }

    // Summary: presence bonus
    if (summary.includes(query)) score += 3;

    if (score > 0) {
      results.push({ note, score, titleMatch: titleIdx, contentMatch: contentIdx });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/** Extract a short snippet of content around the first match. */
export function contentSnippet(content: string, query: string, windowChars = 120): string {
  if (!query.trim()) return content.slice(0, windowChars);
  const lower = content.toLowerCase();
  const idx   = lower.indexOf(query.toLowerCase().trim());
  if (idx === -1) return content.slice(0, windowChars);
  const start = Math.max(0, idx - 40);
  const end   = Math.min(content.length, start + windowChars);
  const snippet = content.slice(start, end);
  return (start > 0 ? '…' : '') + snippet + (end < content.length ? '…' : '');
}
