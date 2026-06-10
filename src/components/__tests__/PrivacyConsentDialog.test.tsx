import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';
import { PrivacyConsentDialog } from '../PrivacyConsentDialog';

jest.mock('react-native', () => ({
  Platform:   { OS: 'test', select: (o: any) => o.default ?? o.android },
  Modal:      'Modal',
  View:       'View',
  Text:       'Text',
  Pressable:  'Pressable',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (s: object) => s, flatten: (s: unknown) => s },
}));

describe('PrivacyConsentDialog', () => {
  it('renders when visible=true', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <PrivacyConsentDialog visible providerName="Google Gemini" onAccept={jest.fn()} onDecline={jest.fn()} />,
      );
    });
    expect(renderer.toJSON()).not.toBeNull();
  });

  it('calls onAccept when accept button pressed', () => {
    const onAccept = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <PrivacyConsentDialog visible providerName="Google Gemini" onAccept={onAccept} onDecline={jest.fn()} />,
      );
    });
    const btn = renderer.root.findByProps({ testID: 'consent-accept' });
    act(() => btn.props.onPress());
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('calls onDecline when decline button pressed', () => {
    const onDecline = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <PrivacyConsentDialog visible providerName="Google Gemini" onAccept={jest.fn()} onDecline={onDecline} />,
      );
    });
    const btn = renderer.root.findByProps({ testID: 'consent-decline' });
    act(() => btn.props.onPress());
    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});
