import { rankByRelevance } from './tfidf';
import { sanitizeInput } from './sanitize';
import type { Note } from '../notes/Note';

const MAX_CONTEXT_CHARS = 3_000;

export function getRelevantNotes(question: string, notes: Note[], topK = 5): Note[] {
  if (notes.length === 0) return [];
  const docs   = notes.map((n) => `${n.title} ${n.content}`);
  const scores = rankByRelevance(question, docs);
  return notes
    .map((note, i) => ({ note, score: scores[i]! }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ note }) => note);
}

export function buildAskPrompt(question: string, sources: Note[]): string {
  if (sources.length === 0) {
    return (
      'You are a personal knowledge assistant. ' +
      'The user has no journal entries.\n\n' +
      `Question: ${question}\n\n` +
      "Answer: There are no journal entries to search. Write some notes first."
    );
  }

  let context = '';
  for (let i = 0; i < sources.length; i++) {
    const n         = sources[i]!;
    const header    = `[${i + 1}] ${n.title || '(untitled)'}\n`;
    const remaining = MAX_CONTEXT_CHARS - context.length;
    if (remaining < header.length + 10) break;
    const bodyBudget = remaining - header.length - 2; // 2 for trailing \n\n
    const body       = sanitizeInput(n.content).slice(0, bodyBudget);
    context += `${header}${body}\n\n`;
    if (n.content.length > bodyBudget) break; // budget exhausted
  }

  return (
    'You are a personal knowledge assistant. Answer the question using ONLY the journal entries below. ' +
    "If the answer is not found, say \"I couldn't find that in your notes.\"\n\n" +
    `Journal entries:\n${context.trim()}\n\nQuestion: ${question}\n\nAnswer:`
  );
}
