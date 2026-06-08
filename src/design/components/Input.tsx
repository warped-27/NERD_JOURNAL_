/** Input — monospace text input with terminal border. */
import React from 'react';
import { TextInput, type TextInputProps, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderWidth } from '../tokens';

interface Props extends TextInputProps {
  hasError?: boolean;
}

export function Input({ hasError = false, style, ...rest }: Props) {
  return (
    <TextInput
      placeholderTextColor={Colors.textMuted}
      style={[styles.base, hasError && styles.error, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily:        Typography.fontFamily,
    fontSize:          Typography.sizeMd,
    color:             Colors.textBright,
    backgroundColor:   Colors.bgInput,
    borderWidth:       BorderWidth.normal,
    borderColor:       Colors.border,
    borderRadius:      0,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
  },
  error: {
    borderColor: Colors.error,
  },
});
