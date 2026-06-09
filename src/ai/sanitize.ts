export const MAX_PROMPT_CHARS = 4000;

const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/gi,
  /disregard\s+(all\s+)?(prior|previous|above)\s+instructions/gi,
  /forget\s+everything\s+above/gi,
  /system\s*:\s*you\s+are\s+now/gi,
  /you\s+are\s+now\s+a\s+different\s+(ai|model|assistant)/gi,
  /new\s+instructions?\s*:/gi,
  /\[system\]/gi,
  /<\s*system\s*>/gi,
  /act\s+as\s+(if\s+you\s+(are|were)|a[n]?\s)/gi,
  /\bjailbreak\b/gi,
  /\bDAN\b/g,
  /prompt\s+injection/gi,
];

// Unicode non-ASCII whitespace: U+00A0 (NBSP), U+2000-U+200A (typographic spaces),
// U+202F (narrow NBSP), U+205F (math space), U+3000 (ideographic space).
const UNICODE_SPACES = /[  -   　]/g;

export function sanitizeInput(text: string): string {
  if (!text) return '';

  let s = text;

  // Truncate
  if (s.length > MAX_PROMPT_CHARS) s = s.slice(0, MAX_PROMPT_CHARS);

  // Strip zero-width and invisible Unicode characters
  s = s.replace(/[​-‏‪-‮⁠-⁤﻿]/g, '');

  // Strip null bytes
  s = s.replace(/\x00/g, '');

  // Strip control chars except \n (0x0A) and \t (0x09)
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x01-\x08\x0B-\x1F\x7F]/g, '');

  // Normalize non-ASCII whitespace to regular space so injection patterns
  // cannot be bypassed using Unicode lookalikes (no-break space, em/en spaces, etc.).
  s = s.replace(UNICODE_SPACES, ' ');

  // Remove injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    s = s.replace(pattern, '[removed]');
  }

  // Collapse multiple spaces to single (not newlines, not tabs)
  s = s.replace(/ {2,}/g, ' ');

  return s;
}
