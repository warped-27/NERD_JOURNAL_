/** Cyberpunk / terminal aesthetic — green on black, monospace, no border-radius. */

export const Colors = {
  bg:        '#000000',
  bgSurface: '#0a0a0a',
  bgInput:   '#0d0d0d',

  green:     '#00ff41',
  greenDim:  '#00cc33',
  greenMute: '#006600',
  greenBg:   '#001a00',

  border:    '#004400',
  borderBright: '#00aa00',

  textPrimary:   '#00ff41',
  textSecondary: '#00cc33',
  textMuted:     '#006600',
  textInverse:   '#000000',

  error:   '#ff0040',
  warning: '#ffaa00',
  success: '#00ff41',
} as const;

export const Typography = {
  fontFamily: 'SpaceMono',
  fontFamilyFallback: 'monospace',

  sizeXs:  11,
  sizeSm:  13,
  sizeMd:  15,
  sizeLg:  18,
  sizeXl:  22,
  size2xl: 28,

  weightNormal: '400' as const,
  weightBold:   '700' as const,

  lineHeightTight:  1.2,
  lineHeightNormal: 1.5,
  lineHeightLoose:  1.8,
} as const;

export const Spacing = {
  px:  1,
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

export const Radius = {
  none: 0,
} as const;

export const BorderWidth = {
  thin:   1,
  normal: 1,
} as const;
