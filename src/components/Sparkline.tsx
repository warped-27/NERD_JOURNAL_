import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { SparkDay } from '../stats/noteStats';
import { Colors } from '../design/tokens';

interface Props {
  data:      SparkDay[];
  barWidth?: number;
  barGap?:   number;
  maxHeight?: number;
}

export function Sparkline({ data, barWidth = 5, barGap = 2, maxHeight = 24 }: Props) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <View style={[styles.root, { height: maxHeight, gap: barGap }]} testID="sparkline">
      {data.map(({ date, count }) => {
        const ratio  = count / max;
        const height = count === 0 ? 1 : Math.max(2, Math.round(ratio * maxHeight));
        return (
          <View
            key={date}
            testID={`spark-bar-${date}`}
            style={[
              styles.bar,
              {
                width:           barWidth,
                height,
                opacity:         count === 0 ? 0.12 : 0.3 + ratio * 0.7,
                backgroundColor: Colors.green,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems:    'flex-end',
  },
  bar: {
    borderRadius: 0,
  },
});
