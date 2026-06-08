/**
 * T — typed text primitive with semantic variants.
 * Always monospace, always a Colors shade, never a border-radius.
 */
import React from 'react';
import { Text, type TextProps, StyleSheet } from 'react-native';
import { Colors, Typography } from '../tokens';

type Variant =
  | 'body'
  | 'label'
  | 'caption'
  | 'heading'
  | 'title'
  | 'mono'
  | 'error'
  | 'muted'
  | 'bright'
  | 'kicker'
  | 'dim';

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

  // Content variants
  body:    {
    fontSize:   Typography.sizeMd,
    lineHeight: Typography.sizeMd * Typography.lineHeightNormal,
    color:      Colors.textPrimary,
  },
  bright:  {
    fontSize:   Typography.sizeMd,
    color:      Colors.textBright,
    fontFamily: Typography.fontFamily,
  },
  muted:   {
    fontSize: Typography.sizeSm,
    color:    Colors.textSecondary,
    lineHeight: Typography.sizeSm * Typography.lineHeightNormal,
  },
  dim:     {
    fontSize: Typography.sizeXs,
    color:    Colors.textMuted,
  },

  // Structure variants
  heading: {
    fontSize:   Typography.sizeLg,
    fontFamily: Typography.fontFamilyBold,
    color:      Colors.textBright,
    letterSpacing: -0.3,
  },
  title: {
    fontSize:      Typography.size2xl,
    fontFamily:    Typography.fontFamilyBold,
    color:         Colors.textBright,
    letterSpacing: -1,
    lineHeight:    Typography.size2xl * Typography.lineHeightTight,
  },
  label: {
    fontSize:      Typography.sizeSm,
    color:         Colors.textSecondary,
    letterSpacing: Typography.trackingWide,
    textTransform: 'uppercase' as const,
  },
  caption: {
    fontSize:      Typography.sizeXs,
    color:         Colors.textMuted,
    letterSpacing: 0.5,
  },
  kicker: {
    fontSize:      Typography.sizeXs,
    color:         Colors.green,
    letterSpacing: Typography.trackingXWide,
    textTransform: 'uppercase' as const,
  },

  // Semantic variants
  mono:  {
    fontSize:   Typography.sizeMd,
    fontFamily: Typography.fontFamily,
    color:      Colors.green,
  },
  error: {
    fontSize: Typography.sizeSm,
    color:    Colors.error,
  },
});
