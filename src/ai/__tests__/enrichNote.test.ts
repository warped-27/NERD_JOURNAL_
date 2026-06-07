import { enrichNote } from '../enrichNote';
import * as gemini from '../geminiService';
import { ok, err } from '../../lib/result';

jest.mock('../geminiService');
const mockCallGemini = gemini.callGemini as jest.MockedFunction<typeof gemini.callGemini>;

const VALID_RESPONSE = JSON.stringify({
  tags:    ['coding', 'typescript', 'notes'],
  summary: '• Worked on TypeScript project\n• Fixed a bug in the parser',
  palette: ['#00ffff', '#ff00ff'],
});

describe('enrichNote', () => {
  beforeEach(() => mockCallGemini.mockClear());

  it('returns err when both title and content are empty', async () => {
    const r = await enrichNote('', '', 'key');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('empty');
  });

  it('returns err when Gemini call fails', async () => {
    mockCallGemini.mockResolvedValue(err(new Error('network')));
    const r = await enrichNote('title', 'content', 'key');
    expect(r.ok).toBe(false);
  });

  it('parses valid enrichment response', async () => {
    mockCallGemini.mockResolvedValue(ok(VALID_RESPONSE));
    const r = await enrichNote('My Note', 'some content', 'key');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.tags).toEqual(['coding', 'typescript', 'notes']);
    expect(r.value.summary).toContain('TypeScript');
    expect(r.value.palette).toEqual(['#00ffff', '#ff00ff']);
  });

  it('strips markdown fences if model adds them', async () => {
    mockCallGemini.mockResolvedValue(ok('```json\n' + VALID_RESPONSE + '\n```'));
    const r = await enrichNote('title', 'body', 'key');
    expect(r.ok).toBe(true);
  });

  it('returns err on invalid JSON', async () => {
    mockCallGemini.mockResolvedValue(ok('not valid json'));
    const r = await enrichNote('title', 'body', 'key');
    expect(r.ok).toBe(false);
  });

  it('returns err on malformed response shape', async () => {
    mockCallGemini.mockResolvedValue(ok('{"tags":"wrong","summary":1,"palette":[]}'));
    const r = await enrichNote('title', 'body', 'key');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('shape');
  });

  it('sanitizes tags — strips non-alphanumeric chars', async () => {
    mockCallGemini.mockResolvedValue(ok(JSON.stringify({
      tags: ['hello world', 'valid-tag', 'BAD!@#'],
      summary: '• point',
      palette: ['#00ffff', '#ff00ff'],
    })));
    const r = await enrichNote('t', 'c', 'key');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.tags).toContain('valid-tag');
    expect(r.value.tags.every((t) => /^[a-z0-9-]*$/.test(t))).toBe(true);
  });

  it('filters palette colors not in the allowed set', async () => {
    mockCallGemini.mockResolvedValue(ok(JSON.stringify({
      tags: ['tag'],
      summary: '• s',
      palette: ['#badcolor', '#00ffff'],
    })));
    const r = await enrichNote('t', 'c', 'key');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.palette).toEqual(['#00ffff']);
  });

  it('calls Gemini with low temperature and model when provided', async () => {
    mockCallGemini.mockResolvedValue(ok(VALID_RESPONSE));
    await enrichNote('title', 'content', 'mykey', 'gemini-2.0-flash');
    const call = mockCallGemini.mock.calls[0]![0]!;
    expect(call.apiKey).toBe('mykey');
    expect(call.model).toBe('gemini-2.0-flash');
    expect(call.temperature).toBeLessThanOrEqual(0.3);
  });
});
