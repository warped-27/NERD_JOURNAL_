import { Colors, Typography, Spacing, Radius } from '../tokens';

describe('design tokens', () => {
  it('background is near-black (phosphor palette)', () => {
    expect(Colors.bg).toBe('#04070a');
  });

  it('primary text is grey-green (not pure green)', () => {
    expect(Colors.textPrimary).toBe('#cbd6cf');
  });

  it('primary accent is phosphor green', () => {
    expect(Colors.green).toBe('#1cff9b');
  });

  it('border-radius is always 0', () => {
    expect(Radius.none).toBe(0);
  });

  it('font family is JetBrainsMono', () => {
    expect(Typography.fontFamily).toBe('JetBrainsMono');
  });

  it('fallback font is SpaceMono', () => {
    expect(Typography.fontFamilyFallback).toBe('SpaceMono');
  });

  it('spacing values form a 4pt grid', () => {
    expect(Spacing.xs % 4).toBe(0);
    expect(Spacing.sm % 4).toBe(0);
    expect(Spacing.md % 4).toBe(0);
    expect(Spacing.lg % 4).toBe(0);
    expect(Spacing.xl % 4).toBe(0);
  });

  it('all Color values are valid CSS hex strings', () => {
    for (const [, v] of Object.entries(Colors)) {
      expect(v).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
