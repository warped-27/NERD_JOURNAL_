import { useEffect } from 'react';
import { Platform } from 'react-native';

interface Handlers {
  onNewNote?: () => void;
  onAsk?:     () => void;
  onBack?:    () => void;
}

/**
 * Registers in-app keyboard shortcuts for the web/Tauri desktop context.
 * No-op on native iOS/Android.
 *
 * Shortcuts:
 *   Cmd/Ctrl + N  → new note
 *   Cmd/Ctrl + K  → open Ask modal
 *   Escape        → back / dismiss
 */
export function useKeyboardShortcuts(handlers: Handlers) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        handlers.onNewNote?.();
        return;
      }
      if (mod && e.key === 'k') {
        e.preventDefault();
        handlers.onAsk?.();
        return;
      }
      if (e.key === 'Escape') {
        handlers.onBack?.();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // handlers object changes every render; destructure stable references instead
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers.onNewNote, handlers.onAsk, handlers.onBack]);
}
