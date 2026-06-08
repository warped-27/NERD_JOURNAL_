import { enrichNote } from '../enrichNote';
import { ok, err } from '../../lib/result';
import type { Result } from '../../lib/result';

function makeCompleter(response: Result<string, Error>) {
  return jest.fn(async (_prompt: string) => response);
}

const VALID_RESPONSE = JSON.stringify({
  tags:    ['coding', 'typescript', 'notes'],
  summary: '• Worked on TypeScript project\n• Fixed a bug in the parser',
  palette: ['#00ffff', '#ff00ff'],
});

describe('enrichNote', () => {
  it('returns err when both title and content are empty', async () => {
    const completer = makeCompleter(ok(''));
    const r = await enrichNote('', '', completer);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('empty');
    expect(completer).not.toHaveBeenCalled();
  });

  it('returns err when completer fails', async () => {
    const r = await enrichNote('title', 'content', makeCompleter(err(new Error('network'))));
    expect(r.ok).toBe(false);
  });

  it('parses valid enrichment response', async () => {
    const r = await enrichNote('My Note', 'some content', makeCompleter(ok(VALID_RESPONSE)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.tags).toEqual(['coding', 'typescript', 'notes']);
    expect(r.value.summary).toContain('TypeScript');
    expect(r.value.palette).toEqual(['#00ffff', '#ff00ff']);
  });

  it('strips markdown fences if model adds them', async () => {
    const r = await enrichNote('title', 'body', makeCompleter(ok('```json\n' + VALID_RESPONSE + '\n```')));
    expect(r.ok).toBe(true);
  });

  it('returns err on invalid JSON', async () => {
    const r = await enrichNote('title', 'body', makeCompleter(ok('not valid json')));
    expect(r.ok).toBe(false);
  });

  it('returns err on malformed response shape', async () => {
    const r = await enrichNote('title', 'body', makeCompleter(ok('{"tags":"wrong","summary":1,"palette":[]}')));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('shape');
  });

  it('sanitizes tags — strips non-alphanumeric chars', async () => {
    const r = await enrichNote('t', 'c', makeCompleter(ok(JSON.stringify({
      tags:    ['hello world', 'valid-tag', 'BAD!@#'],
      summary: '• point',
      palette: ['#00ffff', '#ff00ff'],
    }))));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.tags).toContain('valid-tag');
    expect(r.value.tags.every((t) => /^[a-z0-9-]*$/.test(t))).toBe(true);
  });

  it('filters palette colors not in the allowed set', async () => {
    const r = await enrichNote('t', 'c', makeCompleter(ok(JSON.stringify({
      tags:    ['tag'],
      summary: '• s',
      palette: ['#badcolor', '#00ffff'],
    }))));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.palette).toEqual(['#00ffff']);
  });

  it('passes the note content to the completer prompt', async () => {
    const completer = makeCompleter(ok(VALID_RESPONSE));
    await enrichNote('My Title', 'my content here', completer);
    const prompt = completer.mock.calls[0]![0] as string;
    expect(prompt).toContain('My Title');
    expect(prompt).toContain('my content here');
  });
});
