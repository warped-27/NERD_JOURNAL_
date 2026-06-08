/** Btn — terminal-style button, no border-radius. */
import React from 'react';
import { Pressable, type PressableProps, StyleSheet, ActivityIndicator } from 'react-native';
import { T } from './T';
import { Colors, Typography, Spacing, BorderWidth } from '../tokens';

type Variant = 'primary' | 'ghost' | 'danger';

interface Props extends PressableProps {
  label:    string;
  variant?: Variant;
  loading?: boolean;
}

export function Btn({ label, variant = 'primary', loading = false, style, disabled, ...rest }: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      disabled={isDisabled}
      accessibilityRole="button"
      {...rest}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? Colors.textInverse : Colors.green} size="small" />
        : <T variant="label" style={[styles.label, styles[`${variant}Label` as keyof typeof styles]]}>{label}</T>
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth:       BorderWidth.normal,
    borderRadius:      0,
    paddingVertical:   Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems:        'center',
    justifyContent:    'center',
    minHeight:         44,
  },
  primary: {
    backgroundColor: Colors.green,
    borderColor:     Colors.green,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor:     Colors.border,
  },
  danger: {
    backgroundColor: 'transparent',
    borderColor:     Colors.error,
  },
  pressed:  { opacity: 0.75 },
  disabled: { opacity: 0.35 },
  label: {
    fontFamily:    Typography.fontFamily,
    letterSpacing: Typography.trackingWide,
  },
  primaryLabel: { color: Colors.textInverse },
  ghostLabel:   { color: Colors.textPrimary },
  dangerLabel:  { color: Colors.error },
});
