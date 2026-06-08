import React from 'react';
import { View } from 'react-native';

/** CRT scanlines — web/Tauri only. Absolute overlay, pointer-events:none. */
export function Scanlines() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 2,
        opacity: 0.32,
        // @ts-ignore — web-only CSS
        backgroundImage:
          'repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.22) 3px, rgba(0,0,0,0) 4px)',
      }}
    />
  );
}
