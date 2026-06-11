import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Btn } from '../design/components/Btn';
import { T } from '../design/components/T';
import { Colors, Spacing } from '../design/tokens';

interface Props {
  onScanned: (url: string) => void;
}

export function LanSyncScanner({ onScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = React.useState(false);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.permBox}>
        <T variant="muted" style={styles.hint}>
          Camera access is needed to scan the QR code shown on your desktop.
        </T>
        <Btn
          label="ALLOW CAMERA"
          variant="primary"
          onPress={requestPermission}
          style={styles.btn}
        />
      </View>
    );
  }

  return (
    <View style={styles.scannerBox}>
      <CameraView
        style={styles.camera}
        onBarcodeScanned={scanned ? undefined : ({ data }) => {
          if (data.startsWith('njlan://')) {
            setScanned(true);
            onScanned(data);
          }
        }}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <T variant="caption" style={styles.caption}>
        Point at the QR code on your desktop
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  permBox:    { gap: Spacing.sm, paddingVertical: Spacing.md },
  hint:       { lineHeight: 18 },
  btn:        { alignSelf: 'stretch' },
  scannerBox: { gap: Spacing.sm },
  camera:     { width: '100%', height: 220, backgroundColor: Colors.bg },
  caption:    { textAlign: 'center', color: Colors.textMuted },
});
