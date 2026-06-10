import React from 'react';
import { Modal, View, StyleSheet, ScrollView } from 'react-native';
import { T } from '../design/components/T';
import { Btn } from '../design/components/Btn';
import { Colors, Spacing } from '../design/tokens';

interface Props {
  visible:      boolean;
  providerName: string;
  onAccept:     () => void;
  onDecline:    () => void;
}

export function PrivacyConsentDialog({ visible, providerName, onAccept, onDecline }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDecline}
      testID="consent-modal"
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <T variant="heading" style={styles.title}>CLOUD AI — PRIVACY NOTICE</T>

          <ScrollView style={styles.body} testID="consent-body">
            <T variant="body">
              To process your request, the note content will be{' '}
              <T variant="mono">decrypted in memory</T> and sent to{' '}
              <T variant="mono">{providerName}</T> via an encrypted HTTPS connection.
            </T>

            <T variant="body" style={styles.para}>
              By continuing you acknowledge:
            </T>

            <T variant="label" style={styles.bullet}>
              {'• '}Your note text leaves this device and is processed by {providerName}.
            </T>
            <T variant="label" style={styles.bullet}>
              {'• '}{providerName} may log requests per their terms of service.
            </T>
            <T variant="label" style={styles.bullet}>
              {'• '}Avoid sending highly sensitive data (passwords, financial info).
            </T>
            <T variant="label" style={styles.bullet}>
              {'• '}Your API key is stored only on this device.
            </T>
            <T variant="label" style={styles.bullet}>
              {'• '}If a local provider fails, requests may fall back to this cloud service.
            </T>

            <T variant="muted" style={styles.para}>
              This consent covers all configured cloud providers and will not be asked again.
              You can revoke it by removing all cloud API keys in Settings.
            </T>
          </ScrollView>

          <View style={styles.actions}>
            <Btn
              variant="ghost"
              label="DECLINE"
              onPress={onDecline}
              testID="consent-decline"
              style={styles.btnHalf}
            />
            <Btn
              variant="primary"
              label="I AGREE"
              onPress={onAccept}
              testID="consent-accept"
              style={styles.btnHalf}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         Spacing.md,
  },
  dialog: {
    width:           '100%',
    maxWidth:        480,
    backgroundColor: Colors.bgSurface,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         Spacing.lg,
  },
  title:  { marginBottom: Spacing.md },
  body:   { maxHeight: 300 },
  para:   { marginTop: Spacing.sm },
  bullet: { marginTop: Spacing.xs, paddingLeft: Spacing.sm },
  actions: {
    flexDirection: 'row',
    gap:           Spacing.sm,
    marginTop:     Spacing.lg,
  },
  btnHalf: { flex: 1 },
});
