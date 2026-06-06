/** Box — styled View primitive. Background defaults to Colors.bg. */
import React from 'react';
import { View, type ViewProps, StyleSheet } from 'react-native';
import { Colors } from '../tokens';

interface Props extends ViewProps {
  surface?: boolean; // slightly lighter bg for cards/panels
}

export function Box({ surface = false, style, ...rest }: Props) {
  return <View style={[styles.base, surface && styles.surface, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base:    { backgroundColor: Colors.bg },
  surface: { backgroundColor: Colors.bgSurface },
});
