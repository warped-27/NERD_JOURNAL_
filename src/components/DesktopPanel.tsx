import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../design/tokens';

interface Props {
  sidebar: React.ReactNode;
  main:    React.ReactNode;
}

/**
 * Two-column desktop layout: fixed-width sidebar on the left, flex main area
 * on the right. Only rendered on Tauri/web; native uses standard navigation.
 */
export function DesktopPanel({ sidebar, main }: Props) {
  return (
    <View style={styles.root} testID="desktop-panel">
      <View style={styles.sidebar}>{sidebar}</View>
      <View style={styles.divider} />
      <View style={styles.main}>{main}</View>
    </View>
  );
}

const SIDEBAR_WIDTH = 320;

const styles = StyleSheet.create({
  root: {
    flex:          1,
    flexDirection: 'row',
  },
  sidebar: {
    width:           SIDEBAR_WIDTH,
    flexShrink:      0,
    borderRightWidth: 0, // divider handles the border
  },
  divider: {
    width:           1,
    backgroundColor: Colors.border,
  },
  main: {
    flex: 1,
  },
});
