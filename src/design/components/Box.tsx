/** Box — styled View primitive. background defaults to Colors.bg. */
import React from 'react';
import { View, type ViewProps, StyleSheet } from 'react-native';
import { Colors } from '../tokens';
import { Glow } from './Glow';
import { Scanlines } from './Scanlines';

interface Props extends ViewProps {
  surface?: boolean; // card / panel bg
  panel?:   boolean; // slightly elevated panel
  screen?:  boolean; // full-screen root — adds glow + scanlines
}

export function Box({ surface = false, panel = false, screen = false, style, children, ...rest }: Props) {
  return (
    <View
      style={[
        styles.base,
        surface && styles.surface,
        panel   && styles.panel,
        screen  && styles.screen,
        style,
      ]}
      {...rest}
    >
      {screen && <Glow />}
      {screen && <Scanlines />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base:    { backgroundColor: Colors.bg },
  surface: { backgroundColor: Colors.bgSurface },
  panel:   { backgroundColor: Colors.bgPanel },
  screen:  { flex: 1, backgroundColor: Colors.bg },
});
