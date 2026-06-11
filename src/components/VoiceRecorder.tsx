import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  useAudioRecorder,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';
import type { Attachment } from '../notes/Note';
import { newId } from '../lib/id';
import { useAi } from '../ai/AiContext';
import { useWhisper } from '../ai/whisper/WhisperContext';
import { transcribeAudioWithFallback } from '../ai/transcribeAudio';

import { T }   from '../design/components/T';
import { Btn } from '../design/components/Btn';
import { Colors, Spacing } from '../design/tokens';

interface Props {
  onAdd:    (attachment: Attachment) => void;
  onCancel: () => void;
}

type RecordState = 'idle' | 'recording' | 'recorded' | 'transcribing';

export function VoiceRecorder({ onAdd, onCancel }: Props) {
  const ai      = useAi();
  const whisper = useWhisper();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [state,       setState]       = useState<RecordState>('idle');
  const [duration,    setDuration]    = useState(0);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioUri,    setAudioUri]    = useState<string | null>(null);
  const [error,       setError]       = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      recorder.stop().catch(() => {});
    };
  }, [recorder]);

  const startRecording = useCallback(async () => {
    setError('');
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { setError('Microphone permission denied.'); return; }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setState('recording');
      setDuration(0);

      intervalRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recording failed');
    }
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    try {
      await recorder.stop();
      const uri = recorder.uri;

      if (!uri) { setError('No audio captured.'); setState('idle'); return; }

      const resp = await fetch(uri);
      const blob = await resp.blob();
      const b64  = await blobToBase64(blob);
      setAudioBase64(b64);
      setAudioUri(uri);
      setState('recorded');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stop failed');
      setState('idle');
    }
  }, [recorder]);

  const handleSave = useCallback(() => {
    if (!audioBase64) return;
    const attachment: Attachment = {
      id:        newId(),
      type:      'voice',
      createdAt: Date.now(),
      data:      audioBase64,
      mimeType:  'audio/m4a',
      duration,
    };
    onAdd(attachment);
  }, [audioBase64, duration, onAdd]);

  const handleTranscribe = useCallback(async () => {
    if (!audioBase64 || !audioUri) return;

    const whisperFn = whisper.status === 'loaded' ? whisper.transcribe : null;
    setState('transcribing');
    setError('');
    const result = await transcribeAudioWithFallback(audioUri, audioBase64, 'audio/m4a', whisperFn);
    if (result.ok) {
      const attachment: Attachment = {
        id:            newId(),
        type:          'voice',
        createdAt:     Date.now(),
        data:          audioBase64,
        mimeType:      'audio/m4a',
        duration,
        transcription: result.value,
      };
      onAdd(attachment);
    } else {
      setError(result.error.message);
      setState('recorded');
    }
  }, [audioBase64, audioUri, whisper.status, whisper.transcribe, duration, onAdd]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <View style={styles.root} testID="voice-recorder">
      <T variant="label" style={styles.heading}>VOICE NOTE</T>

      <T variant="mono" style={styles.timer}>{fmt(duration)}</T>

      {error ? <T variant="error" style={styles.error}>{error}</T> : null}

      {state === 'idle' && (
        <Btn variant="primary" label="● REC" onPress={startRecording} testID="rec-start" />
      )}

      {state === 'recording' && (
        <Btn variant="danger" label="■ STOP" onPress={stopRecording} testID="rec-stop" />
      )}

      {state === 'recorded' && (
        <View style={styles.actions}>
          <Btn variant="ghost"   label="RE-RECORD"  onPress={() => { setState('idle'); setDuration(0); }} style={styles.btn} testID="rec-redo" />
          <Btn variant="ghost"   label="SAVE AUDIO" onPress={handleSave}       style={styles.btn} testID="rec-save" />
          {ai.hasAnyProvider && (
            <Btn variant="primary" label="TRANSCRIBE"  onPress={handleTranscribe} style={styles.btn} testID="rec-transcribe" />
          )}
        </View>
      )}

      {state === 'transcribing' && (
        <Btn variant="ghost" label="Transcribing…" loading onPress={() => {}} />
      )}

      <Btn variant="ghost" label="CANCEL" onPress={onCancel} style={styles.cancel} testID="rec-cancel" />
    </View>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      resolve(r.split(',')[1] ?? r);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const styles = StyleSheet.create({
  root:    { borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.md, gap: Spacing.sm },
  heading: { marginBottom: Spacing.xs },
  timer:   { fontSize: 32, textAlign: 'center', color: Colors.green, marginBottom: Spacing.sm },
  error:   { marginBottom: Spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  btn:     { flex: 1, minWidth: 100 },
  cancel:  { marginTop: Spacing.xs },
});
