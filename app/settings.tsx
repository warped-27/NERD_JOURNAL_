import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAi, GEMINI_MODELS } from '../src/ai/AiContext';
import { useSync } from '../src/sync/SyncContext';
import { useNotes } from '../src/notes/NotesContext';
import { webdavPush, webdavPull, testWebDavConnection } from '../src/sync/providers/webdavSync';
import { exportToFile, importFromFile } from '../src/sync/providers/fileSync';
import { Box } from '../src/design/components/Box';
import { T } from '../src/design/components/T';
import { Input } from '../src/design/components/Input';
import { Btn } from '../src/design/components/Btn';
import { Colors, Spacing } from '../src/design/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const ai    = useAi();
  const sync  = useSync();
  const notes = useNotes();
  const [key,   setKey]   = useState(ai.apiKey ?? '');
  const [saved, setSaved] = useState(false);

  // WebDAV form state (seeded from stored config)
  const wdCfg  = sync.config.provider === 'webdav' ? sync.config.webdav : undefined;
  const [wdUrl,      setWdUrl]      = useState(wdCfg?.url      ?? '');
  const [wdUser,     setWdUser]     = useState(wdCfg?.username  ?? '');
  const [wdPass,     setWdPass]     = useState(wdCfg?.password  ?? '');
  const [wdTesting,  setWdTesting]  = useState(false);
  const [wdSyncing,  setWdSyncing]  = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  async function handleSave() {
    await ai.setApiKey(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClear() {
    await ai.clearApiKey();
    setKey('');
  }

  async function handleWebDavSave() {
    const url = wdUrl.trim();
    if (!url) return;
    setWdTesting(true);
    setSyncStatus('');
    try {
      await testWebDavConnection({ url, username: wdUser.trim(), password: wdPass });
      await sync.setConfig({ provider: 'webdav', webdav: { url, username: wdUser.trim(), password: wdPass } });
      setSyncStatus('WebDAV configured ✓');
    } catch (e) {
      setSyncStatus(e instanceof Error ? e.message : 'Connection test failed');
    } finally {
      setWdTesting(false);
    }
  }

  async function handleSyncNow() {
    if (sync.config.provider !== 'webdav' || !sync.config.webdav) return;
    setWdSyncing(true);
    setSyncStatus('');
    try {
      const bundle  = await notes.exportBundle();
      const remote  = await webdavPull(sync.config.webdav);
      if (remote) await notes.importBundle(remote);
      const merged  = await notes.exportBundle();
      await webdavPush(sync.config.webdav, merged);
      sync.setLastSyncAt(Date.now());
      setSyncStatus('Sync complete ✓');
    } catch (e) {
      setSyncStatus(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setWdSyncing(false);
    }
  }

  async function handleDisconnectWebDav() {
    await sync.setConfig({ provider: 'none' });
    setSyncStatus('WebDAV disconnected');
  }

  async function handleExportFile() {
    setSyncStatus('');
    try {
      const bundle = await notes.exportBundle();
      await exportToFile(bundle);
      setSyncStatus('Export complete ✓');
    } catch (e) {
      setSyncStatus(e instanceof Error ? e.message : 'Export failed');
    }
  }

  async function handleImportFile() {
    setSyncStatus('');
    try {
      const bundle = await importFromFile();
      if (!bundle) { setSyncStatus('Import cancelled'); return; }
      const result = await notes.importBundle(bundle);
      setSyncStatus(`Imported ${result.imported} note(s) ✓`);
    } catch (e) {
      setSyncStatus(e instanceof Error ? e.message : 'Import failed');
    }
  }

  return (
    <Box screen style={styles.root}>
      {/* Nav */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="settings-back">
          <T variant="kicker">← back</T>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ─── API KEY ─── */}
        <T variant="heading" style={styles.section}>AI SETTINGS</T>

        <T variant="label" style={styles.label}>GEMINI API KEY</T>
        <T variant="muted" style={styles.hint}>
          Stored only on this device. Get a free key at aistudio.google.com
        </T>

        <Input
          value={key}
          onChangeText={setKey}
          placeholder="AIza…"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          testID="settings-apikey"
        />

        <View style={styles.actions}>
          <Btn
            label={saved ? 'SAVED ✓' : 'SAVE KEY'}
            variant="primary"
            onPress={handleSave}
            style={styles.btn}
            testID="settings-save"
          />
          {ai.apiKey && (
            <Btn
              label="CLEAR KEY"
              variant="danger"
              onPress={handleClear}
              style={styles.btn}
              testID="settings-clear"
            />
          )}
        </View>

        {ai.apiKey && (
          <T variant="muted" style={styles.status} testID="settings-key-status">
            Key configured: ••••••••
          </T>
        )}

        {/* ─── AUTO-ENRICH ─── */}
        <T variant="label" style={[styles.label, styles.modelTitle]}>AUTO-ENRICH NOTES</T>
        <T variant="muted" style={styles.hint}>
          When enabled, notes are automatically tagged and summarised by AI after each save.
          Your note content is sent to Gemini. Requires consent and a configured API key.
        </T>
        <Pressable
          style={[styles.toggleRow, ai.autoEnrich && styles.toggleRowActive]}
          onPress={() => ai.setAutoEnrich(!ai.autoEnrich)}
          accessibilityRole="switch"
          accessibilityState={{ checked: ai.autoEnrich }}
          testID="settings-autoenrich"
        >
          <View style={[styles.radio, ai.autoEnrich && styles.radioActive]} />
          <T variant={ai.autoEnrich ? 'label' : 'muted'} style={styles.modelLabel}>
            {ai.autoEnrich ? 'ENABLED' : 'DISABLED'}
          </T>
        </Pressable>

        {/* ─── MODEL ─── */}
        <T variant="label" style={[styles.label, styles.modelTitle]}>AI MODEL</T>
        <T variant="muted" style={styles.hint}>
          Flash Lite is free-tier and fastest. Flash is more capable.
        </T>

        {GEMINI_MODELS.map((m) => {
          const active = ai.model === m.id;
          return (
            <Pressable
              key={m.id}
              style={[styles.modelRow, active && styles.modelRowActive]}
              onPress={() => ai.setModel(m.id)}
              testID={`model-${m.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.radio, active && styles.radioActive]} />
              <T variant={active ? 'label' : 'muted'} style={styles.modelLabel}>
                {m.label}
              </T>
            </Pressable>
          );
        })}

        {/* ─── SYNC ─── */}
        <T variant="heading" style={[styles.section, styles.syncHeading]}>
          SYNC
          {!sync.hasConfigured && (
            <T variant="caption" style={styles.warnBadge}> ⚠ NOT CONFIGURED</T>
          )}
        </T>

        {!sync.hasConfigured && (
          <T variant="muted" style={[styles.hint, styles.warnText]}>
            Notes exist only on this device. Configure sync to back up and share
            across devices.
          </T>
        )}

        {/* WebDAV form */}
        <T variant="label" style={styles.label}>WEBDAV / NEXTCLOUD</T>
        <T variant="muted" style={styles.hint}>
          Nextcloud, ownCloud, Syncthing WebDAV, or any standard WebDAV server.
        </T>
        <Input
          value={wdUrl}
          onChangeText={setWdUrl}
          placeholder="https://cloud.example.com/remote.php/dav/files/user"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
          testID="sync-webdav-url"
        />
        <Input
          value={wdUser}
          onChangeText={setWdUser}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          testID="sync-webdav-user"
        />
        <Input
          value={wdPass}
          onChangeText={setWdPass}
          placeholder="password or app token"
          secureTextEntry
          style={styles.input}
          testID="sync-webdav-pass"
        />
        <View style={styles.actions}>
          <Btn
            label={wdTesting ? 'TESTING…' : 'TEST & SAVE'}
            variant="primary"
            onPress={handleWebDavSave}
            loading={wdTesting}
            style={styles.btn}
            testID="sync-webdav-save"
          />
          {sync.config.provider === 'webdav' && (
            <Btn
              label={wdSyncing ? 'SYNCING…' : 'SYNC NOW'}
              variant="ghost"
              onPress={handleSyncNow}
              loading={wdSyncing}
              style={styles.btn}
              testID="sync-now"
            />
          )}
        </View>
        {sync.config.provider === 'webdav' && (
          <>
            <T variant="muted" style={styles.status}>
              {sync.lastSyncAt
                ? `Last sync: ${new Date(sync.lastSyncAt).toLocaleString()}`
                : 'Never synced on this session'}
            </T>
            <Btn
              label="DISCONNECT WEBDAV"
              variant="danger"
              onPress={handleDisconnectWebDav}
              style={[styles.btn, styles.disconnectBtn]}
              testID="sync-disconnect"
            />
          </>
        )}

        {/* File export/import */}
        <T variant="label" style={[styles.label, styles.modelTitle]}>BACKUP FILE</T>
        <T variant="muted" style={styles.hint}>
          Export an encrypted vault bundle (.njvault) to file, or import one to
          restore notes from another device.
        </T>
        <View style={styles.actions}>
          <Btn
            label="EXPORT FILE"
            variant="ghost"
            onPress={handleExportFile}
            style={styles.btn}
            testID="sync-export-file"
          />
          <Btn
            label="IMPORT FILE"
            variant="ghost"
            onPress={handleImportFile}
            style={styles.btn}
            testID="sync-import-file"
          />
        </View>

        {syncStatus ? (
          <T
            variant={syncStatus.includes('✓') ? 'label' : 'error'}
            style={styles.status}
            testID="sync-status"
          >
            {syncStatus}
          </T>
        ) : null}

      </ScrollView>
    </Box>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  nav: {
    paddingHorizontal: Spacing.md,
    paddingTop:        Spacing.xl,
    paddingBottom:     Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn:    { alignSelf: 'flex-start' },
  content:    { padding: Spacing.md, paddingBottom: Spacing.xxl },
  section:    { marginBottom: Spacing.lg },
  label:      { marginBottom: Spacing.xs },
  hint:       { marginBottom: Spacing.md, lineHeight: 18 },
  input:      { marginBottom: Spacing.md },
  actions:    { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  btn:        { flex: 1 },
  status:     { marginTop: Spacing.xs },
  modelTitle: { marginTop: Spacing.lg },
  modelRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderWidth:    1,
    borderColor:    Colors.border,
    marginBottom:   Spacing.xs,
    gap:            Spacing.sm,
  },
  modelRowActive: { borderColor: Colors.green, backgroundColor: Colors.greenBg },
  toggleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderWidth:    1,
    borderColor:    Colors.border,
    marginBottom:   Spacing.md,
    gap:            Spacing.sm,
  },
  toggleRowActive: { borderColor: Colors.green, backgroundColor: Colors.greenBg },
  radio: {
    width:        12,
    height:       12,
    borderRadius: 0,
    borderWidth:  1,
    borderColor:  Colors.greenDim,
  },
  radioActive: { backgroundColor: Colors.green, borderColor: Colors.green },
  modelLabel:     { flex: 1 },
  syncHeading:    { marginTop: Spacing.xl, marginBottom: Spacing.sm },
  warnBadge:      { color: Colors.warning, fontSize: 11 },
  warnText:       { color: Colors.warning },
  disconnectBtn:  { marginTop: Spacing.xs },
});
