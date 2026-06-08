import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';
import { AiAssistant } from '../AiAssistant';
import { useAi } from '../../ai/AiContext';
import { ok, err } from '../../lib/result';

jest.mock('react-native', () => ({
  Platform:          { OS: 'test', select: (o: any) => o.default ?? o.android },
  View:              'View',
  Text:              'Text',
  TextInput:         'TextInput',
  Pressable:         'Pressable',
  ScrollView:        'ScrollView',
  Modal:             'Modal',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet:        { create: (s: object) => s, flatten: (s: unknown) => s },
}));

jest.mock('../../ai/AiContext', () => ({ useAi: jest.fn() }));
jest.mock('../PrivacyConsentDialog', () => ({ PrivacyConsentDialog: () => null }));

const mockUseAi = useAi as jest.MockedFunction<typeof useAi>;

function makeAiCtx(overrides: Partial<ReturnType<typeof useAi>> = {}): ReturnType<typeof useAi> {
  return {
    apiKey:             'test-key',
    setApiKey:          jest.fn(),
    clearApiKey:        jest.fn(),
    model:              'gemini-2.0-flash-lite',
    setModel:           jest.fn(),
    hasConsented:       true,
    giveConsent:        jest.fn(),
    declineConsent:     jest.fn(),
    pendingConsent:     false,
    requestWithConsent: jest.fn(),
    doComplete:         jest.fn(),
    isLoading:          false,
    autoEnrich:         false,
    setAutoEnrich:      jest.fn(),
    hasAnyProvider:     true,
    ollamaConfig:       { enabled: false, baseUrl: 'http://localhost:11434', model: 'llama3.2:3b' },
    mlxConfig:          { enabled: false, baseUrl: 'http://localhost:8080',  model: 'mlx-community/Llama-3.2-3B-Instruct-4bit' },
    setOllamaConfig:    jest.fn(),
    setMlxConfig:       jest.fn(),
    ...overrides,
  };
}

describe('AiAssistant', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows no-key message when apiKey is null', () => {
    mockUseAi.mockReturnValue(makeAiCtx({ apiKey: null }));
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AiAssistant noteContent="note" />);
    });
    const noKey = renderer.root.findByProps({ testID: 'ai-no-key' });
    expect(noKey).not.toBeNull();
  });

  it('shows assistant panel when apiKey is set', () => {
    mockUseAi.mockReturnValue(makeAiCtx());
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AiAssistant noteContent="note" />);
    });
    const panel = renderer.root.findByProps({ testID: 'ai-assistant' });
    expect(panel).not.toBeNull();
  });

  it('calls requestWithConsent with instruction and noteContent', async () => {
    const requestWithConsent = jest.fn().mockResolvedValue(ok('AI says hello'));
    mockUseAi.mockReturnValue(makeAiCtx({ requestWithConsent }));
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AiAssistant noteContent="My journal" />);
    });

    const input = renderer.root.findByProps({ testID: 'ai-input' });
    await act(async () => { input.props.onChangeText('summarize this'); });

    const btn = renderer.root.findByProps({ testID: 'ai-ask-btn' });
    await act(async () => { btn.props.onPress(); });

    expect(requestWithConsent).toHaveBeenCalledWith('My journal', 'summarize this');
  });

  it('displays AI response on success', async () => {
    const requestWithConsent = jest.fn().mockResolvedValue(ok('Great note!'));
    mockUseAi.mockReturnValue(makeAiCtx({ requestWithConsent }));
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AiAssistant noteContent="note" />);
    });

    const input = renderer.root.findByProps({ testID: 'ai-input' });
    await act(async () => { input.props.onChangeText('summarize'); });
    const btn = renderer.root.findByProps({ testID: 'ai-ask-btn' });
    await act(async () => { btn.props.onPress(); });

    const response = renderer.root.findByProps({ testID: 'ai-response' });
    expect(response).not.toBeNull();
  });

  it('displays error on failure', async () => {
    const requestWithConsent = jest.fn().mockResolvedValue(err(new Error('Rate limit exceeded')));
    mockUseAi.mockReturnValue(makeAiCtx({ requestWithConsent }));
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AiAssistant noteContent="note" />);
    });

    const input = renderer.root.findByProps({ testID: 'ai-input' });
    await act(async () => { input.props.onChangeText('summarize'); });
    const btn = renderer.root.findByProps({ testID: 'ai-ask-btn' });
    await act(async () => { btn.props.onPress(); });

    const errorEl = renderer.root.findByProps({ testID: 'ai-error' });
    expect(errorEl).not.toBeNull();
  });

  it('does not call AI when instruction is empty', async () => {
    const requestWithConsent = jest.fn();
    mockUseAi.mockReturnValue(makeAiCtx({ requestWithConsent }));
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AiAssistant noteContent="note" />);
    });

    const btn = renderer.root.findByProps({ testID: 'ai-ask-btn' });
    await act(async () => { btn.props.onPress(); });

    expect(requestWithConsent).not.toHaveBeenCalled();
  });
});
