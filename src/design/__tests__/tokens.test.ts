import { Colors, Typography, Spacing, Radius } from '../tokens';

describe('design tokens', () => {
  it('background is pure black', () => {
    expect(Colors.bg).toBe('#000000');
  });

  it('primary text is matrix green', () => {
    expect(Colors.textPrimary).toBe('#00ff41');
  });

  it('border-radius is always 0', () => {
    expect(Radius.none).toBe(0);
  });

  it('font family is SpaceMono', () => {
    expect(Typography.fontFamily).toBe('SpaceMono');
  });

  it('spacing values form a 4pt grid', () => {
    expect(Spacing.xs % 4).toBe(0);
    expect(Spacing.sm % 4).toBe(0);
    expect(Spacing.md % 4).toBe(0);
    expect(Spacing.lg % 4).toBe(0);
    expect(Spacing.xl % 4).toBe(0);
  });

  it('no color contains border-radius or padding (tokens are pure values)', () => {
    // spot-check: all Color values are valid CSS hex strings
    for (const [k, v] of Object.entries(Colors)) {
      expect(v).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
