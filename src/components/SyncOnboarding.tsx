import React, { useState } from 'react';
import { View, Modal, ScrollView, StyleSheet } from 'react-native';
import { useSync }  from '../sync/SyncContext';
import { T }        from '../design/components/T';
import { Btn }      from '../design/components/Btn';
import { Input }    from '../design/components/Input';
import { Colors, Spacing } from '../design/tokens';

interface Props {
  visible:  boolean;
  onDone:   () => void;
}

type Screen = 'choice' | 'webdav';

export function SyncOnboarding({ visible, onDone }: Props) {
  const sync = useSync();
  const [screen,   setScreen]   = useState<Screen>('choice');
  const [url,      setUrl]      = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [testing,  setTesting]  = useState(false);
  const [error,    setError]    = useState('');

  function handleSkip() {
    onDone();
  }

  function handleSingleDevice() {
    void sync.setConfig({ provider: 'none' });
    onDone();
  }

  async function handleWebDavSave() {
    const trimUrl = url.trim();
    if (!trimUrl) { setError('Enter a WebDAV URL.'); return; }
    setError('');
    setTesting(true);
    try {
      const { testWebDavConnection } = await import('../sync/providers/webdavSync');
      await testWebDavConnection({ url: trimUrl, username: username.trim(), password });
      await sync.setConfig({
        provider: 'webdav',
        webdav:   { url: trimUrl, username: username.trim(), password },
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            {screen === 'choice' && (
              <>
                <T variant="kicker" style={styles.heading}>SYNC SETUP</T>
                <T variant="muted" style={styles.body}>
                  Your notes are encrypted locally. Without sync, they exist
                  only on this device and cannot be recovered if lost.
                </T>

                <Btn
                  label="WEBDAV / NEXTCLOUD"
                  variant="primary"
                  onPress={() => setScreen('webdav')}
                  style={styles.btn}
                  testID="onboard-webdav"
                />
                <Btn
                  label="SINGLE DEVICE — no sync"
                  variant="ghost"
                  onPress={handleSingleDevice}
                  style={styles.btn}
                  testID="onboard-none"
                />
                <Btn
                  label="SKIP — configure later"
                  variant="ghost"
                  onPress={handleSkip}
                  style={styles.btn}
                  testID="onboard-skip"
                />
              </>
            )}

            {screen === 'webdav' && (
              <>
                <T variant="kicker" style={styles.heading}>WEBDAV CONFIG</T>
                <T variant="muted" style={styles.body}>
                  Works with Nextcloud, Syncthing WebDAV, ownCloud, and any
                  standard WebDAV server.
                </T>

                <T variant="label" style={styles.label}>SERVER URL</T>
                <Input
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://cloud.example.com/remote.php/dav/files/you"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={styles.input}
                  hasError={!!error}
                  testID="webdav-url"
                />
                <T variant="label" style={styles.label}>USERNAME</T>
                <Input
                  value={username}
                  onChangeText={setUsername}
                  placeholder="username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  testID="webdav-user"
                />
                <T variant="label" style={styles.label}>PASSWORD / APP TOKEN</T>
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder="password or app token"
                  secureTextEntry
                  style={styles.input}
                  testID="webdav-pass"
                />

                {error ? <T variant="error" style={styles.error}>{error}</T> : null}

                <View style={styles.row}>
                  <Btn
                    label="← back"
                    variant="ghost"
                    onPress={() => { setScreen('choice'); setError(''); }}
                    style={styles.halfBtn}
                    testID="webdav-back"
                  />
                  <Btn
                    label={testing ? 'TESTING…' : 'TEST & SAVE'}
                    variant="primary"
                    onPress={handleWebDavSave}
                    loading={testing}
                    style={styles.halfBtn}
                    testID="webdav-save"
                  />
                </View>
                <Btn
                  label="SKIP — configure later"
                  variant="ghost"
                  onPress={handleSkip}
                  style={styles.btn}
                  testID="webdav-skip"
                />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(4,7,10,0.88)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         Spacing.lg,
  },
  card: {
    width:           '100%',
    maxWidth:        440,
    backgroundColor: Colors.bgPanel,
    borderWidth:     1,
    borderColor:     Colors.border,
  },
  scroll:  { padding: Spacing.lg },
  heading: { marginBottom: Spacing.md },
  body:    { marginBottom: Spacing.lg, lineHeight: 20 },
  label:   { marginBottom: Spacing.xs },
  input:   { marginBottom: Spacing.md },
  error:   { marginBottom: Spacing.sm },
  btn:     { marginBottom: Spacing.xs },
  row:     { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
  halfBtn: { flex: 1 },
});
