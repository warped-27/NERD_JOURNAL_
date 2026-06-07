import type { Result } from '../lib/result';
import { ok, err } from '../lib/result';
import { sanitizeInput } from './sanitize';
import { callGemini } from './geminiService';

export interface NoteEnrichment {
  tags:    string[];
  summary: string;
  palette: string[];
}

// Allowed accent palette — neon hues that complement the green-on-black theme
const ALLOWED_PALETTE = new Set([
  '#00ffff', '#ff00ff', '#ffaa00', '#ff4400',
  '#4400ff', '#00ff88', '#ff0066', '#aaff00',
]);

const ENRICH_SYSTEM =
  'You are a personal journal assistant. Analyze the note and respond ONLY with valid JSON — ' +
  'no markdown fences, no extra text.';

function buildPrompt(title: string, content: string): string {
  return (
    `${ENRICH_SYSTEM}\n\n` +
    `Note title: "${title}"\n` +
    `Note content:\n"""\n${content}\n"""\n\n` +
    'Return this exact JSON shape:\n' +
    '{\n' +
    '  "tags": ["tag1","tag2","tag3"],\n' +
    '  "summary": "• point one\\n• point two\\n• point three",\n' +
    '  "palette": ["#hex1","#hex2"]\n' +
    '}\n\n' +
    'Rules:\n' +
    '- tags: 3-5 lowercase words/hyphenated-words relevant to the note\n' +
    '- summary: 2-4 bullet points joined by \\n\n' +
    '- palette: exactly 2 hex colors chosen from: ' +
    [...ALLOWED_PALETTE].join(', ')
  );
}

export async function enrichNote(
  title:   string,
  content: string,
  apiKey:  string,
  model?:  string,
): Promise<Result<NoteEnrichment, Error>> {
  const safeTitle   = sanitizeInput(title);
  const safeContent = sanitizeInput(content);

  if (!safeContent.trim() && !safeTitle.trim()) {
    return err(new Error('Note is empty — nothing to enrich'));
  }

  const result = await callGemini({
    prompt:          buildPrompt(safeTitle, safeContent),
    apiKey,
    model,
    maxOutputTokens: 256,
    temperature:     0.3,
  });

  if (!result.ok) return result;

  try {
    // Strip optional markdown fences the model might still add
    const raw = result.value.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const parsed = JSON.parse(raw) as unknown;

    if (
      typeof parsed !== 'object' || parsed === null ||
      !Array.isArray((parsed as Record<string, unknown>).tags) ||
      typeof (parsed as Record<string, unknown>).summary !== 'string' ||
      !Array.isArray((parsed as Record<string, unknown>).palette)
    ) {
      return err(new Error('Enrichment response has unexpected shape'));
    }

    const p = parsed as Record<string, unknown>;

    const enrichment: NoteEnrichment = {
      tags: (p['tags'] as unknown[])
        .slice(0, 6)
        .map((t) => String(t).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24))
        .filter(Boolean),
      summary: String(p['summary']).slice(0, 600),
      palette: (p['palette'] as unknown[])
        .slice(0, 3)
        .map((c) => String(c).toLowerCase())
        .filter((c) => ALLOWED_PALETTE.has(c)),
    };

    return ok(enrichment);
  } catch {
    return err(new Error('Failed to parse enrichment JSON from model response'));
  }
}
