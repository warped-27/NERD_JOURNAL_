import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { T }     from '../design/components/T';
import { Input } from '../design/components/Input';
import { Btn }   from '../design/components/Btn';
import { Colors, Spacing } from '../design/tokens';

interface Props {
  onAdd: (url: string, title: string) => void;
  onCancel: () => void;
}

const PRIVATE_HOSTNAME =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|::1|0\.0\.0\.0)/i;

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (PRIVATE_HOSTNAME.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function LinkInput({ onAdd, onCancel }: Props) {
  const [url,   setUrl]   = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  function handleAdd() {
    const trimmed = url.trim();
    if (!isValidUrl(trimmed)) {
      setError('Enter a valid https:// URL');
      return;
    }
    setError('');
    onAdd(trimmed, title.trim());
  }

  return (
    <View style={styles.root} testID="link-input">
      <T variant="label" style={styles.heading}>ADD LINK</T>

      <Input
        value={url}
        onChangeText={(v) => { setUrl(v); setError(''); }}
        placeholder="https://…"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={styles.input}
        hasError={!!error}
        testID="link-url"
      />
      {error ? <T variant="error" style={styles.error}>{error}</T> : null}

      <Input
        value={title}
        onChangeText={setTitle}
        placeholder="Title (optional)"
        style={styles.input}
        testID="link-title"
      />

      <View style={styles.actions}>
        <Btn variant="ghost"    label="CANCEL" onPress={onCancel} style={styles.btn} testID="link-cancel" />
        <Btn variant="primary"  label="ADD"    onPress={handleAdd} style={styles.btn} testID="link-add" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md, paddingHorizontal: Spacing.md },
  heading: { marginBottom: Spacing.sm },
  input:   { marginBottom: Spacing.xs },
  error:   { marginBottom: Spacing.xs },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  btn:     { flex: 1 },
});
