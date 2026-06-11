import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';
import { NoteEditor } from '../NoteEditor';

jest.mock('../AiAssistant',     () => ({ AiAssistant:     () => null }));
jest.mock('../AttachmentPicker', () => ({ AttachmentPicker: () => null }));
jest.mock('../AttachmentList',   () => ({ AttachmentList:   () => null }));
jest.mock('../../ai/AiContext', () => ({
  useAi: () => ({
    ask:            jest.fn().mockResolvedValue({ ok: false, error: new Error('no provider') }),
    isLoading:      false,
    hasAnyProvider: false,
    ollamaConfig:   { enabled: false, baseUrl: 'http://localhost:11434', model: '' },
    mlxConfig:      { enabled: false, baseUrl: 'http://localhost:8080',  model: '' },
    autoEnrich:     false,
    setAutoEnrich:  jest.fn(),
  }),
}));

jest.mock('react-native', () => ({
  Platform:      { OS: 'web' },
  View:          'View',
  Text:          'Text',
  TextInput:     'TextInput',
  Pressable:     'Pressable',
  ScrollView:    'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet:    { create: (s: object) => s, flatten: (s: unknown) => s },
}));

const INITIAL = { title: 'Draft title', content: 'Draft content' };

describe('NoteEditor', () => {
  it('shows initial title and content', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <NoteEditor initialTitle={INITIAL.title} initialContent={INITIAL.content} onSave={onSave} />
      );
    });
    const inputs = renderer.root.findAll((n) => (n.type as unknown as string) === 'TextInput');
    expect(inputs[0]?.props.value).toBe('Draft title');
    expect(inputs[1]?.props.value).toBe('Draft content');
  });

  it('calls onSave with updated title and content', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <NoteEditor initialTitle="Old" initialContent="Old body" onSave={onSave} />
      );
    });
    const inputs = renderer.root.findAll((n) => (n.type as unknown as string) === 'TextInput');
    await act(async () => {
      inputs[0]?.props.onChangeText('New title');
      inputs[1]?.props.onChangeText('New content');
    });
    const saveBtn = renderer.root.findByProps({ testID: 'save-btn' });
    await act(async () => { saveBtn.props.onPress(); });
    expect(onSave).toHaveBeenCalledWith({ title: 'New title', content: 'New content', attachments: [] });
  });

  it('calls onDelete when delete button pressed', async () => {
    const onSave   = jest.fn().mockResolvedValue(undefined);
    const onDelete = jest.fn().mockResolvedValue(undefined);
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <NoteEditor initialTitle="t" initialContent="c" onSave={onSave} onDelete={onDelete} />
      );
    });
    const deleteBtn = renderer.root.findByProps({ testID: 'delete-btn' });
    await act(async () => { deleteBtn.props.onPress(); });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not render delete button when onDelete is not provided', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <NoteEditor initialTitle="t" initialContent="c" onSave={onSave} />
      );
    });
    expect(() => renderer.root.findByProps({ testID: 'delete-btn' })).toThrow();
  });
});
