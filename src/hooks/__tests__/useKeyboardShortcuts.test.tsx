import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

/** Thin wrapper so we can mount the hook in react-test-renderer */
function Fixture({ handlers }: { handlers: Parameters<typeof useKeyboardShortcuts>[0] }) {
  useKeyboardShortcuts(handlers);
  return null;
}

type Handler = (e: Record<string, unknown>) => void;
let capturedListener: Handler | null = null;
const originalAdd    = globalThis.addEventListener;
const originalRemove = globalThis.removeEventListener;

beforeEach(() => {
  capturedListener = null;
  globalThis.addEventListener = (type: string, fn: EventListenerOrEventListenerObject) => {
    if (type === 'keydown') capturedListener = fn as Handler;
  };
  globalThis.removeEventListener = () => {};
});

afterEach(() => {
  globalThis.addEventListener    = originalAdd;
  globalThis.removeEventListener = originalRemove;
});

function fire(key: string, opts: { metaKey?: boolean; ctrlKey?: boolean } = {}) {
  capturedListener?.({ key, preventDefault: () => {}, ...opts });
}

describe('useKeyboardShortcuts', () => {
  it('registers a keydown listener on mount', () => {
    act(() => { TestRenderer.create(<Fixture handlers={{}} />); });
    expect(capturedListener).not.toBeNull();
  });

  it('calls onNewNote on Ctrl+N', () => {
    const onNewNote = jest.fn();
    act(() => { TestRenderer.create(<Fixture handlers={{ onNewNote }} />); });
    fire('n', { ctrlKey: true });
    expect(onNewNote).toHaveBeenCalledTimes(1);
  });

  it('calls onNewNote on Cmd+N', () => {
    const onNewNote = jest.fn();
    act(() => { TestRenderer.create(<Fixture handlers={{ onNewNote }} />); });
    fire('n', { metaKey: true });
    expect(onNewNote).toHaveBeenCalledTimes(1);
  });

  it('calls onAsk on Ctrl+K', () => {
    const onAsk = jest.fn();
    act(() => { TestRenderer.create(<Fixture handlers={{ onAsk }} />); });
    fire('k', { ctrlKey: true });
    expect(onAsk).toHaveBeenCalledTimes(1);
  });

  it('calls onBack on Escape', () => {
    const onBack = jest.fn();
    act(() => { TestRenderer.create(<Fixture handlers={{ onBack }} />); });
    fire('Escape');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('ignores N without modifier', () => {
    const onNewNote = jest.fn();
    act(() => { TestRenderer.create(<Fixture handlers={{ onNewNote }} />); });
    fire('n'); // no ctrlKey or metaKey
    expect(onNewNote).not.toHaveBeenCalled();
  });

  it('ignores unrelated key with modifier', () => {
    const onNewNote = jest.fn();
    act(() => { TestRenderer.create(<Fixture handlers={{ onNewNote }} />); });
    fire('x', { ctrlKey: true });
    expect(onNewNote).not.toHaveBeenCalled();
  });
});
