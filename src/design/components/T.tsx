/**
 * T — typed text primitive with semantic variants.
 * Always monospace, always a Colors shade, never a border-radius.
 */
import React from 'react';
import { Text, type TextProps, StyleSheet } from 'react-native';
import { Colors, Typography } from '../tokens';

type Variant = 'body' | 'label' | 'caption' | 'heading' | 'title' | 'mono' | 'error' | 'muted';

interface Props extends TextProps {
  variant?: Variant;
}

export function T({ variant = 'body', style, ...rest }: Props) {
  return <Text style={[styles.base, styles[variant], style]} {...rest} />;
}

const base = {
  fontFamily: Typography.fontFamily,
  color:      Colors.textPrimary,
} as const;

const styles = StyleSheet.create({
  base:    { ...base, fontSize: Typography.sizeMd },
  body:    { fontSize: Typography.sizeMd, lineHeight: Typography.sizeMd * Typography.lineHeightNormal },
  label:   { fontSize: Typography.sizeSm, letterSpacing: 1 },
  caption: { fontSize: Typography.sizeXs, color: Colors.textMuted },
  heading: { fontSize: Typography.sizeLg, fontFamily: Typography.fontFamily, color: Colors.green },
  title:   { fontSize: Typography.size2xl, fontFamily: Typography.fontFamily, color: Colors.green },
  mono:    { fontSize: Typography.sizeMd, fontFamily: Typography.fontFamily },
  error:   { fontSize: Typography.sizeSm, color: Colors.error },
  muted:   { fontSize: Typography.sizeSm, color: Colors.textMuted },
});
