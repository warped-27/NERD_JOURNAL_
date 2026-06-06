import React from 'react';
import { Modal, View, StyleSheet, ScrollView } from 'react-native';
import { T } from '../design/components/T';
import { Btn } from '../design/components/Btn';
import { Colors, Spacing } from '../design/tokens';

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function PrivacyConsentDialog({ visible, onAccept, onDecline }: Props) {
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
              To process your request, the selected note content will be sent to{' '}
              <T variant="mono">Google Gemini API</T> (cloud service).
            </T>

            <T variant="body" style={styles.para}>
              By continuing you acknowledge:
            </T>

            <T variant="label" style={styles.bullet}>
              {'• '}Your note text will leave this device and be processed by Google.
            </T>
            <T variant="label" style={styles.bullet}>
              {'• '}Google may log requests per their terms of service.
            </T>
            <T variant="label" style={styles.bullet}>
              {'• '}Avoid sending highly sensitive personal data (passwords, financial info).
            </T>
            <T variant="label" style={styles.bullet}>
              {'• '}Your Gemini API key is stored locally on this device only.
            </T>

            <T variant="muted" style={styles.para}>
              This consent is stored locally and will not be asked again.
              You can revoke it by clearing your API key in Settings.
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
