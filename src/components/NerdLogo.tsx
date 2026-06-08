import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, type ViewStyle } from 'react-native';
import { T } from '../design/components/T';
import { Colors, Typography } from '../design/tokens';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<Size, { fontSize: number; cursorW: number; cursorH: number }> = {
  sm: { fontSize: 14, cursorW:  7, cursorH: 16 },
  md: { fontSize: 22, cursorW: 11, cursorH: 26 },
  lg: { fontSize: 32, cursorW: 16, cursorH: 38 },
  xl: { fontSize: 48, cursorW: 24, cursorH: 56 },
};

interface Props {
  size?:     Size;
  tagline?:  string;
  showDot?:  boolean; // blinking red dot (kicker style)
  style?:    ViewStyle;
}

export function NerdLogo({ size = 'md', tagline, showDot = false, style }: Props) {
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  const dotOpacity    = useRef(new Animated.Value(1)).current;
  const { fontSize, cursorW, cursorH } = SIZE_MAP[size];

  useEffect(() => {
    const cursor = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(cursorOpacity, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(cursorOpacity, { toValue: 1, duration: 0, useNativeDriver: true }),
      ]),
    );
    cursor.start();
    return () => cursor.stop();
  }, [cursorOpacity]);

  useEffect(() => {
    if (!showDot) return;
    const dot = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(dotOpacity, { toValue: 0.15, duration: 0, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(dotOpacity, { toValue: 1,    duration: 0, useNativeDriver: true }),
      ]),
    );
    dot.start();
    return () => dot.stop();
  }, [showDot, dotOpacity]);

  return (
    <View style={[styles.root, style]}>
      {tagline && (
        <View style={styles.kickerRow}>
          {showDot && (
            <Animated.View style={[styles.dot, { opacity: dotOpacity }]} />
          )}
          <T variant="kicker">{tagline}</T>
        </View>
      )}

      <View style={styles.logoRow}>
        <T
          style={{
            fontSize,
            fontFamily:    Typography.fontFamilyBold,
            color:         Colors.green,
            letterSpacing: -0.5,
            lineHeight:    fontSize * 1.05,
            // glow on web
            // @ts-ignore
            textShadow: `0 0 22px rgba(28,255,155,0.45)`,
          }}
        >
          NERD_JOURNAL_
        </T>
        <Animated.View
          style={[
            styles.cursor,
            {
              width:  cursorW,
              height: cursorH,
              opacity: cursorOpacity,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { alignSelf: 'flex-start' },
  kickerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    marginBottom:   10,
  },
  dot: {
    width:           7,
    height:          7,
    borderRadius:    4,
    backgroundColor: Colors.error,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
  },
  cursor: {
    marginLeft:      3,
    backgroundColor: Colors.green,
    marginBottom:    3,
  },
});
