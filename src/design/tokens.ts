/** Cyberpunk / phosphor-terminal aesthetic — audit palette, JetBrains Mono */

export const Colors = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  bg:          '#04070a',  // near-black with slight green tint
  bgSurface:   '#070b0e',  // panels
  bgPanel:     '#0a0f12',  // cards
  bgPanel2:    '#0c1216',  // card gradient bottom
  bgInput:     '#05100b',  // input fields
  bgGreenDeep: '#06301f',  // selection / highlight bg

  // ── Phosphor greens ───────────────────────────────────────────────────────
  green:     '#1cff9b',  // main accent — phosphor
  greenDim:  '#0bbf73',  // secondary accent
  greenMute: '#0e3a27',  // border on active elements
  greenBg:   '#06301f',  // subtle green background

  // ── Borders ───────────────────────────────────────────────────────────────
  border:       '#1a2520',  // default line
  borderBright: '#27332c',  // hover / active

  // ── Text ──────────────────────────────────────────────────────────────────
  textPrimary:   '#cbd6cf',  // body — grey-green, NOT pure green
  textSecondary: '#7e8d84',  // secondary / labels
  textMuted:     '#4a564f',  // faint / captions
  textBright:    '#eafff5',  // headings / emphasis
  textInverse:   '#04070a',  // on green buttons

  // ── Severity accents ──────────────────────────────────────────────────────
  error:   '#ff4d4d',  // critical red
  warning: '#ff9f1c',  // amber
  yellow:  '#ffd23f',  // medium
  cyan:    '#22d3ee',  // info / low
  success: '#1cff9b',  // = green
} as const;

export const Typography = {
  fontFamily:         'JetBrainsMono',
  fontFamilyBold:     'JetBrainsMono-Bold',
  fontFamilyFallback: 'SpaceMono',
  fontFamilySys:      'monospace',

  sizeXs:  11,
  sizeSm:  13,
  sizeMd:  15,
  sizeLg:  18,
  sizeXl:  22,
  size2xl: 32,

  weightNormal:    '400' as const,
  weightMedium:    '500' as const,
  weightBold:      '700' as const,
  weightExtraBold: '800' as const,

  lineHeightTight:  1.2,
  lineHeightNormal: 1.65,
  lineHeightLoose:  1.8,

  trackingWide:    1.5,   // px — label tracking
  trackingXWide:   3,     // px — section kickers
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

export const Radius = { none: 0 } as const;

export const BorderWidth = {
  thin:   1,
  normal: 1,
} as const;
