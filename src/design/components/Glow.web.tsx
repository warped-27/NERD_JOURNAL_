import React from 'react';
import { View } from 'react-native';

/** Radial phosphor glow — web/Tauri only. Absolute overlay, pointer-events:none. */
export function Glow() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 0,
        // @ts-ignore — web-only CSS
        background: [
          'radial-gradient(1200px 700px at 50% -180px, rgba(28,255,155,0.10), transparent 60%)',
          'radial-gradient(800px 500px at 100% 10%,  rgba(28,255,155,0.05), transparent 60%)',
          'radial-gradient(900px 600px at 0%   30%,  rgba(255,77,77,0.04),  transparent 60%)',
        ].join(', '),
      }}
    />
  );
}
