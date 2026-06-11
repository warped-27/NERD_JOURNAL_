import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { isNativePlatform, isTauri } from '../src/platform/detect';
import { useVault } from '../src/crypto/VaultContext';
import { useAi } from '../src/ai/AiContext';
import { useOnDevice } from '../src/ai/onDevice/OnDeviceContext';
import { useWhisper } from '../src/ai/whisper/WhisperContext';
import { testOpenAiCompatConnection } from '../src/ai/providers/openAiCompatProvider';
import { useSync } from '../src/sync/SyncContext';
import { useNotes } from '../src/notes/NotesContext';
import { webdavPush, webdavPull, testWebDavConnection } from '../src/sync/providers/webdavSync';
import { exportToFile, importFromFile } from '../src/sync/providers/fileSync';
import {
  startLanServer, getLanSyncResult, stopLanServer,
  mobileSync, parseLanUrl, type LanSyncInfo,
} from '../src/sync/providers/lanSync';
import { classifySyncError } from '../src/sync/syncError';
import { bundleToMarkdown } from '../src/export/markdownExport';
import { saveTextFile } from '../src/platform/fileSystem';
import { ConflictResolutionModal } from '../src/components/ConflictResolutionModal';
import { LanSyncScanner } from '../src/components/LanSyncScanner';
import { Box } from '../src/design/components/Box';
import { T } from '../src/design/components/T';
import { Input } from '../src/design/components/Input';
import { Btn } from '../src/design/components/Btn';
import { Colors, Spacing } from '../src/design/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const vault    = useVault();
  const ai       = useAi();
  const onDevice = useOnDevice();
  const whisper  = useWhisper();
  const sync     = useSync();
  const notes = useNotes();

  // Ollama form state
  const [ollamaEnabled, setOllamaEnabled] = useState(ai.ollamaConfig.enabled);
  const [ollamaUrl,     setOllamaUrl]     = useState(ai.ollamaConfig.baseUrl);
  const [ollamaModel,   setOllamaModel]   = useState(ai.ollamaConfig.model);
  const [ollamaTesting, setOllamaTesting] = useState(false);
  const [ollamaStatus,  setOllamaStatus]  = useState('');

  // MLX form state
  const [mlxEnabled, setMlxEnabled] = useState(ai.mlxConfig.enabled);
  const [mlxUrl,     setMlxUrl]     = useState(ai.mlxConfig.baseUrl);
  const [mlxModel,   setMlxModel]   = useState(ai.mlxConfig.model);
  const [mlxTesting, setMlxTesting] = useState(false);
  const [mlxStatus,  setMlxStatus]  = useState('');

  // WebDAV form state (seeded from stored config)
  const wdCfg  = sync.config.provider === 'webdav' ? sync.config.webdav : undefined;
  const [wdUrl,      setWdUrl]      = useState(wdCfg?.url      ?? '');
  const [wdUser,     setWdUser]     = useState(wdCfg?.username  ?? '');
  const [wdPass,     setWdPass]     = useState(wdCfg?.password  ?? '');
  const [wdTesting,  setWdTesting]  = useState(false);
  const [wdSyncing,  setWdSyncing]  = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  // LAN sync state
  const [lanInfo,        setLanInfo]        = useState<LanSyncInfo | null>(null);
  const [lanCountdown,   setLanCountdown]   = useState(0);
  const [lanStatus,      setLanStatus]      = useState('');
  const [lanScanning,    setLanScanning]    = useState(false);
  const lanPollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const lanTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const lanPollingRef = useRef(false);
  const [lanQrUri,       setLanQrUri]       = useState<string | null>(null);

  // Biometric status
  const [bioLoading, setBioLoading] = useState(false);
  const [bioStatus,  setBioStatus]  = useState('');

  async function handleOllamaSave() {
    const url = ollamaUrl.trim();
    if (!url) return;
    setOllamaTesting(true);
    setOllamaStatus('');
    try {
      if (ollamaEnabled) await testOpenAiCompatConnection(url);
      await ai.setOllamaConfig({ enabled: ollamaEnabled, baseUrl: url, model: ollamaModel.trim() });
      setOllamaStatus(ollamaEnabled ? 'Ollama configured ✓' : 'Ollama disabled ✓');
    } catch (e) {
      setOllamaStatus(e instanceof Error ? e.message : 'Connection test failed');
    } finally {
      setOllamaTesting(false);
    }
  }

  async function handleMlxSave() {
    const url = mlxUrl.trim();
    if (!url) return;
    setMlxTesting(true);
    setMlxStatus('');
    try {
      if (mlxEnabled) await testOpenAiCompatConnection(url);
      await ai.setMlxConfig({ enabled: mlxEnabled, baseUrl: url, model: mlxModel.trim() });
      setMlxStatus(mlxEnabled ? 'MLX configured ✓' : 'MLX disabled ✓');
    } catch (e) {
      setMlxStatus(e instanceof Error ? e.message : 'Connection test failed');
    } finally {
      setMlxTesting(false);
    }
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
      setSyncStatus(classifySyncError(e));
    } finally {
      setWdTesting(false);
    }
  }

  async function handleSyncNow() {
    if (sync.config.provider !== 'webdav' || !sync.config.webdav) return;
    setWdSyncing(true);
    setSyncStatus('');
    try {
      const cfg = sync.config.webdav;

      const pullResult = await webdavPull(cfg, sync.lastEtag);
      let newEtag = sync.lastEtag;

      if (pullResult === null && sync.lastEtag) {
        setSyncStatus('Remote up to date');
      } else if (pullResult) {
        const mergeResult = await notes.importBundle(pullResult.bundle);
        newEtag = pullResult.etag;
        if (mergeResult.conflicts.length > 0) {
          sync.setPendingConflicts(mergeResult.conflicts);
        }
      }

      const lastSyncAt   = sync.lastSyncAt ?? 0;
      const localChanged = !sync.lastSyncAt || (await notes.hasChangedSince(lastSyncAt));

      if (localChanged) {
        const merged = await notes.exportBundle();
        await webdavPush(cfg, merged);
        setSyncStatus('Sync complete ✓');
      } else if (!pullResult || !pullResult.bundle) {
        setSyncStatus('Already up to date ✓');
      } else {
        setSyncStatus('Sync complete ✓');
      }

      const now = Date.now();
      sync.setLastSyncAt(now);
      if (newEtag !== sync.lastEtag) sync.setLastEtag(newEtag);
    } catch (e) {
      const errMsg = classifySyncError(e);
      setSyncStatus(errMsg);
      sync.setLastError(errMsg);
    } finally {
      setWdSyncing(false);
    }
  }

  async function handleDisconnectWebDav() {
    await sync.setConfig({ provider: 'none' });
    setSyncStatus('WebDAV disconnected');
  }

  // ─── File export/import ────────────────────────────────────────────────────

  async function handleExportFile() {
    setSyncStatus('');
    try {
      const bundle = await notes.exportBundle();
      await exportToFile(bundle);
      setSyncStatus('Export complete ✓');
    } catch (e) {
      setSyncStatus(classifySyncError(e));
    }
  }

  async function handleExportMarkdown() {
    setSyncStatus('');
    try {
      const md = bundleToMarkdown(notes.notes);
      await saveTextFile(md, 'nerd_journal_export.md');
      setSyncStatus('Markdown export complete ✓');
    } catch (e) {
      setSyncStatus(classifySyncError(e));
    }
  }

  async function handleImportFile() {
    setSyncStatus('');
    try {
      const bundle = await importFromFile();
      if (!bundle) { setSyncStatus('Import cancelled'); return; }
      const result = await notes.importBundle(bundle);
      if (result.conflicts.length > 0) {
        sync.setPendingConflicts(result.conflicts);
      }
      setSyncStatus(`Imported ${result.imported} note(s) ✓`);
    } catch (e) {
      setSyncStatus(classifySyncError(e));
    }
  }

  // ─── LAN Sync ──────────────────────────────────────────────────────────────

  const stopLan = useCallback(() => {
    if (lanPollRef.current)  clearInterval(lanPollRef.current);
    if (lanTimerRef.current) clearInterval(lanTimerRef.current);
    lanPollRef.current  = null;
    lanTimerRef.current = null;
    lanPollingRef.current = false;
    void stopLanServer().catch(() => {});
    setLanInfo(null);
    setLanQrUri(null);
    setLanCountdown(0);
  }, []);

  useEffect(() => {
    if (lanCountdown === 0 && lanInfo !== null) stopLan();
  }, [lanCountdown, lanInfo, stopLan]);

  async function handleLanStart() {
    setLanStatus('');
    try {
      const bundle     = await notes.exportBundle();
      const bundleJson = JSON.stringify(bundle);
      const info       = await startLanServer(bundleJson);
      setLanInfo(info);
      setLanCountdown(300);

      const QRCode = await import('qrcode');
      const uri = await QRCode.toDataURL(info.url, {
        width: 200,
        color: { dark: '#33ff33', light: '#04070a' },
        margin: 2,
      });
      setLanQrUri(uri);

      lanTimerRef.current = setInterval(() => {
        setLanCountdown((t) => Math.max(0, t - 1));
      }, 1000);

      lanPollRef.current = setInterval(async () => {
        if (lanPollingRef.current) return;
        lanPollingRef.current = true;
        try {
          const result = await getLanSyncResult();
          if (result) {
            stopLan();
            const { parseBundle } = await import('../src/sync/SyncBundle');
            const remoteBundle = parseBundle(result);
            const mergeResult  = await notes.importBundle(remoteBundle);
            if (mergeResult.conflicts.length > 0) {
              sync.setPendingConflicts(mergeResult.conflicts);
            }
            sync.setLastSyncAt(Date.now());
            setLanStatus(`LAN sync complete ✓ — ${mergeResult.imported} note(s) updated`);
          }
        } catch { /* ignore transient poll errors */ }
        finally { lanPollingRef.current = false; }
      }, 1000);
    } catch (e) {
      setLanStatus(e instanceof Error ? e.message : 'LAN sync failed');
    }
  }

  async function handleLanScan(url: string) {
    setLanStatus('Connecting…');
    try {
      const target = parseLanUrl(url);
      const result = await mobileSync(
        target,
        () => notes.exportBundle(),
        (b) => notes.importBundle(b),
      );
      if (result.conflicts.length > 0) sync.setPendingConflicts(result.conflicts);
      sync.setLastSyncAt(Date.now());
      setLanStatus(`LAN sync complete ✓ — ${result.imported} note(s) updated`);
    } catch (e) {
      setLanStatus(e instanceof Error ? e.message : 'LAN sync failed');
    } finally {
      setLanScanning(false);
    }
  }

  // ─── Biometric ─────────────────────────────────────────────────────────────

  async function handleBiometricEnroll() {
    setBioLoading(true);
    setBioStatus('');
    const result = await vault.enableBiometrics();
    setBioLoading(false);
    setBioStatus(result.ok ? 'Biometric unlock enabled ✓' : result.error);
  }

  async function handleBiometricRevoke() {
    setBioLoading(true);
    await vault.disableBiometrics();
    setBioLoading(false);
    setBioStatus('Biometric unlock disabled');
  }

  return (
    <Box screen style={styles.root}>
      {sync.pendingConflicts.length > 0 && (
        <ConflictResolutionModal
          conflicts={sync.pendingConflicts}
          onDone={sync.clearConflicts}
        />
      )}
      {/* Nav */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="settings-back">
          <T variant="kicker">← back</T>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* ─── AUTO-ENRICH ─── */}
        <T variant="heading" style={styles.section}>AI SETTINGS</T>

        <T variant="label" style={styles.label}>AUTO-ENRICH NOTES</T>
        <T variant="muted" style={styles.hint}>
          When enabled, notes are automatically tagged and summarised by AI after each save.
          Requires a local AI provider (on-device model, Ollama, or MLX) to be active.
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

        {/* ─── ON-DEVICE ─── */}
        <T variant="heading" style={[styles.section, styles.syncHeading]}>ON-DEVICE AI</T>
        <T variant="muted" style={styles.hint}>
          Run Gemma 3 4B entirely on this device. No internet required after
          download. Highest privacy — notes never leave your hardware.
        </T>

        {onDevice.status === 'unavailable' ? (
          <T variant="muted" style={styles.hint}>
            On-device inference is only available on iOS and Android native builds.
          </T>
        ) : (
          <>
            <T variant="label" style={styles.label}>
              {onDevice.modelInfo.name}
            </T>
            <T variant="muted" style={styles.hint}>
              {(onDevice.modelInfo.sizeBytes / 1e9).toFixed(1)} GB · Q4_K_M quantisation
            </T>

            <T
              variant={onDevice.status === 'loaded' ? 'label' : 'muted'}
              style={[styles.status, styles.sectionGap]}
              testID="ondevice-status"
            >
              {{
                'not-downloaded': 'Not downloaded',
                downloading:      `Downloading… ${Math.round(onDevice.downloadProgress * 100)}%`,
                'download-error': `Error: ${onDevice.errorMessage ?? 'download failed'}`,
                ready:            'Downloaded — not loaded',
                loading:          `Loading model… ${Math.round(onDevice.downloadProgress * 100)}%`,
                loaded:           'Loaded ✓ — on-device inference active',
                error:            `Error: ${onDevice.errorMessage ?? 'load failed'}`,
                unavailable:      '',
              }[onDevice.status]}
            </T>

            <View style={styles.actions}>
              {onDevice.status === 'not-downloaded' || onDevice.status === 'download-error' ? (
                <Btn
                  label="DOWNLOAD MODEL"
                  variant="primary"
                  onPress={onDevice.startDownload}
                  style={styles.btn}
                  testID="ondevice-download"
                />
              ) : null}

              {onDevice.status === 'downloading' ? (
                <Btn
                  label="CANCEL"
                  variant="danger"
                  onPress={onDevice.cancelDownload}
                  style={styles.btn}
                  testID="ondevice-cancel"
                />
              ) : null}

              {onDevice.status === 'ready' || onDevice.status === 'error' ? (
                <>
                  <Btn
                    label="LOAD MODEL"
                    variant="primary"
                    onPress={onDevice.loadModel}
                    style={styles.btn}
                    testID="ondevice-load"
                  />
                  <Btn
                    label="DELETE"
                    variant="danger"
                    onPress={onDevice.deleteLocalModel}
                    style={styles.btn}
                    testID="ondevice-delete"
                  />
                </>
              ) : null}

              {onDevice.status === 'loaded' ? (
                <Btn
                  label="UNLOAD MODEL"
                  variant="ghost"
                  onPress={onDevice.unloadModel}
                  style={styles.btn}
                  testID="ondevice-unload"
                />
              ) : null}
            </View>
          </>
        )}

        {/* ─── OLLAMA ─── */}
        <T variant="heading" style={[styles.section, styles.syncHeading]}>LOCAL AI</T>
        <T variant="muted" style={styles.hint}>
          Run a local model on your machine or LAN. Local providers are tried first
          in cascade: on-device → Ollama → MLX. Your notes never leave the device.
        </T>

        <T variant="label" style={styles.label}>OLLAMA (LAN / TAILSCALE)</T>
        <T variant="muted" style={styles.hint}>
          Install Ollama, pull a model (e.g. llama3.2:3b), then enable here.
          {isNativePlatform()
            ? ' On mobile, use your computer\'s LAN IP (e.g. http://192.168.1.x:11434) — localhost refers to the phone itself.'
            : ''}
        </T>
        <Pressable
          style={[styles.toggleRow, ollamaEnabled && styles.toggleRowActive]}
          onPress={() => setOllamaEnabled(!ollamaEnabled)}
          accessibilityRole="switch"
          accessibilityState={{ checked: ollamaEnabled }}
          testID="ollama-toggle"
        >
          <View style={[styles.radio, ollamaEnabled && styles.radioActive]} />
          <T variant={ollamaEnabled ? 'label' : 'muted'} style={styles.modelLabel}>
            {ollamaEnabled ? 'ENABLED' : 'DISABLED'}
          </T>
        </Pressable>
        <Input
          value={ollamaUrl}
          onChangeText={setOllamaUrl}
          placeholder="http://localhost:11434"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
          testID="ollama-url"
        />
        <Input
          value={ollamaModel}
          onChangeText={setOllamaModel}
          placeholder="llama3.2:3b"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          testID="ollama-model"
        />
        <Btn
          label={ollamaTesting ? 'TESTING…' : 'SAVE OLLAMA'}
          variant="primary"
          onPress={handleOllamaSave}
          loading={ollamaTesting}
          style={[styles.btn, styles.fullBtn]}
          testID="ollama-save"
        />
        {ollamaStatus ? (
          <T
            variant={ollamaStatus.includes('✓') ? 'label' : 'error'}
            style={[styles.status, styles.sectionGap]}
            testID="ollama-status"
          >
            {ollamaStatus}
          </T>
        ) : null}

        {/* ─── MLX ─── */}
        <T variant="label" style={[styles.label, styles.modelTitle]}>MLX (APPLE SILICON)</T>
        {isNativePlatform() ? (
          <T variant="muted" style={styles.hint}>
            MLX runs on macOS with Apple Silicon — not available on iOS or Android.
          </T>
        ) : (
          <>
        <T variant="muted" style={styles.hint}>
          Run mlx-lm on macOS with Apple Silicon for fast on-device inference.
          Start the server: mlx_lm.server --model &lt;model&gt; --port 8080
        </T>
        <Pressable
          style={[styles.toggleRow, mlxEnabled && styles.toggleRowActive]}
          onPress={() => setMlxEnabled(!mlxEnabled)}
          accessibilityRole="switch"
          accessibilityState={{ checked: mlxEnabled }}
          testID="mlx-toggle"
        >
          <View style={[styles.radio, mlxEnabled && styles.radioActive]} />
          <T variant={mlxEnabled ? 'label' : 'muted'} style={styles.modelLabel}>
            {mlxEnabled ? 'ENABLED' : 'DISABLED'}
          </T>
        </Pressable>
        <Input
          value={mlxUrl}
          onChangeText={setMlxUrl}
          placeholder="http://localhost:8080"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
          testID="mlx-url"
        />
        <Input
          value={mlxModel}
          onChangeText={setMlxModel}
          placeholder="mlx-community/Llama-3.2-3B-Instruct-4bit"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          testID="mlx-model"
        />
        <Btn
          label={mlxTesting ? 'TESTING…' : 'SAVE MLX'}
          variant="primary"
          onPress={handleMlxSave}
          loading={mlxTesting}
          style={[styles.btn, styles.fullBtn]}
          testID="mlx-save"
        />
        {mlxStatus ? (
          <T
            variant={mlxStatus.includes('✓') ? 'label' : 'error'}
            style={[styles.status, styles.sectionGap]}
            testID="mlx-status"
          >
            {mlxStatus}
          </T>
        ) : null}
          </>
        )}

        {/* ─── WHISPER ─── */}
        <T variant="heading" style={[styles.section, styles.syncHeading]}>LOCAL TRANSCRIPTION</T>
        <T variant="muted" style={styles.hint}>
          Whisper Small runs entirely on your device — audio never leaves and
          transcription works offline. The 244 MB model is downloaded once from
          HuggingFace (ggerganov/whisper.cpp) and stored locally.
        </T>

        {whisper.status === 'unavailable' ? (
          <T variant="muted" style={styles.hint}>
            Local Whisper is only available on iOS and Android native builds.
          </T>
        ) : (
          <>
            <T
              variant={whisper.status === 'loaded' ? 'label' : 'muted'}
              style={[styles.status, styles.sectionGap]}
              testID="whisper-status"
            >
              {{
                'not-downloaded': 'Whisper Small — not downloaded (244 MB)',
                downloading:      `Downloading… ${Math.round(whisper.downloadProgress * 100)}%`,
                'download-error': `Error: ${whisper.errorMessage ?? 'download failed'}`,
                ready:            'Whisper Small — downloaded, not loaded',
                loading:          'Loading Whisper model…',
                loaded:           'Whisper Small — loaded ✓ (on-device transcription active)',
                error:            `Error: ${whisper.errorMessage ?? 'load failed'}`,
                unavailable:      '',
              }[whisper.status]}
            </T>

            <View style={styles.actions}>
              {(whisper.status === 'not-downloaded' || whisper.status === 'download-error') && (
                <Btn
                  label="DOWNLOAD WHISPER"
                  variant="primary"
                  onPress={whisper.startDownload}
                  style={styles.btn}
                  testID="whisper-download"
                />
              )}
              {whisper.status === 'downloading' && (
                <Btn
                  label="CANCEL"
                  variant="danger"
                  onPress={whisper.cancelDownload}
                  style={styles.btn}
                  testID="whisper-cancel"
                />
              )}
              {(whisper.status === 'ready' || whisper.status === 'error') && (
                <>
                  <Btn
                    label="LOAD MODEL"
                    variant="primary"
                    onPress={whisper.loadModel}
                    style={styles.btn}
                    testID="whisper-load"
                  />
                  <Btn
                    label="DELETE"
                    variant="danger"
                    onPress={whisper.deleteLocalModel}
                    style={styles.btn}
                    testID="whisper-delete"
                  />
                </>
              )}
              {whisper.status === 'loaded' && (
                <Btn
                  label="UNLOAD MODEL"
                  variant="ghost"
                  onPress={whisper.unloadModel}
                  style={styles.btn}
                  testID="whisper-unload"
                />
              )}
            </View>
          </>
        )}

        {/* ─── SECURITY ─── */}
        {vault.biometricAvailable && (
          <>
            <T variant="heading" style={[styles.section, styles.syncHeading]}>SECURITY</T>
            <T variant="label" style={styles.label}>BIOMETRIC UNLOCK</T>
            <T variant="muted" style={styles.hint}>
              {vault.biometricEnabled
                ? 'Face ID / Fingerprint unlock is active. The vault key is stored in your device secure enclave.'
                : 'Enable Face ID or Fingerprint unlock. The vault key will be stored in your device secure enclave — it never leaves the device.'}
            </T>
            {vault.biometricEnabled ? (
              <Btn
                label={bioLoading ? 'DISABLING…' : 'DISABLE BIOMETRICS'}
                variant="danger"
                onPress={handleBiometricRevoke}
                loading={bioLoading}
                style={[styles.btn, styles.fullBtn]}
                testID="settings-biometric-disable"
              />
            ) : (
              <Btn
                label={bioLoading ? 'ENABLING…' : 'ENABLE BIOMETRICS'}
                variant="primary"
                onPress={handleBiometricEnroll}
                loading={bioLoading}
                disabled={!vault.isUnlocked}
                style={[styles.btn, styles.fullBtn]}
                testID="settings-biometric-enable"
              />
            )}
            {!vault.isUnlocked && !vault.biometricEnabled && (
              <T variant="muted" style={styles.hint}>Unlock the vault first to enable biometrics.</T>
            )}
            {bioStatus ? (
              <T variant={bioStatus.includes('✓') ? 'label' : 'error'} style={styles.status}>
                {bioStatus}
              </T>
            ) : null}
          </>
        )}

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

        {/* ─── LAN SYNC ─── */}
        <T variant="heading" style={[styles.section, styles.syncHeading]}>LAN SYNC</T>
        <T variant="muted" style={styles.hint}>
          Sync with another device on the same Wi-Fi — no internet, no account.
          {isTauri()
            ? ' Start the server here, then tap "Scan QR" on your phone.'
            : isNativePlatform()
            ? ' Start the server on your desktop, then tap Scan QR below.'
            : ' Available on desktop (Tauri) and mobile only.'}
        </T>

        {/* Desktop server */}
        {isTauri() && (
          <>
            {lanInfo ? (
              <View style={styles.lanBox}>
                {lanQrUri ? (
                  <Image
                    source={{ uri: lanQrUri }}
                    style={styles.qr}
                    accessibilityLabel="LAN sync QR code"
                  />
                ) : null}
                <T variant="label" style={styles.lanAddr}>
                  {lanInfo.ip}:{lanInfo.port}
                </T>
                <T variant="muted" style={styles.lanPin}>PIN: {lanInfo.pin}</T>
                <T variant="caption" style={styles.lanTimer}>
                  ⏱ {Math.floor(lanCountdown / 60)}:{String(lanCountdown % 60).padStart(2, '0')}
                </T>
                <Btn
                  label="CANCEL"
                  variant="danger"
                  onPress={stopLan}
                  style={[styles.btn, styles.fullBtn]}
                  testID="lan-cancel"
                />
              </View>
            ) : (
              <Btn
                label="START LAN SYNC"
                variant="primary"
                onPress={handleLanStart}
                style={[styles.btn, styles.fullBtn]}
                testID="lan-start"
              />
            )}
          </>
        )}

        {/* Mobile scanner */}
        {isNativePlatform() && (
          <>
            {lanScanning ? (
              <View style={styles.lanScanBox}>
                <LanSyncScanner onScanned={handleLanScan} />
                <Btn
                  label="CANCEL"
                  variant="ghost"
                  onPress={() => setLanScanning(false)}
                  style={[styles.btn, styles.fullBtn]}
                />
              </View>
            ) : (
              <Btn
                label="SCAN QR"
                variant="primary"
                onPress={() => { setLanStatus(''); setLanScanning(true); }}
                style={[styles.btn, styles.fullBtn]}
                testID="lan-scan"
              />
            )}
          </>
        )}

        {lanStatus ? (
          <T
            variant={lanStatus.includes('✓') ? 'label' : 'error'}
            style={[styles.status, styles.sectionGap]}
            testID="lan-status"
          >
            {lanStatus}
          </T>
        ) : null}

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
          restore notes from another device. Export as Markdown for readable backups.
        </T>
        <View style={styles.actions}>
          <Btn
            label="EXPORT .NJVAULT"
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
        <Btn
          label="EXPORT AS MARKDOWN"
          variant="ghost"
          onPress={handleExportMarkdown}
          style={[styles.btn, styles.fullBtn]}
          testID="sync-export-markdown"
        />

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
  modelLabel:  { flex: 1 },
  syncHeading: { marginTop: Spacing.xl, marginBottom: Spacing.sm },
  warnBadge:   { color: Colors.warning, fontSize: 11 },
  warnText:    { color: Colors.warning },
  disconnectBtn: { marginTop: Spacing.xs },
  fullBtn:     { alignSelf: 'stretch' },
  sectionGap:  { marginBottom: Spacing.md },
  lanBox: {
    alignItems:    'center',
    gap:           Spacing.sm,
    paddingVertical: Spacing.md,
    borderWidth:   1,
    borderColor:   Colors.green,
    marginBottom:  Spacing.md,
  },
  qr:       { width: 200, height: 200 },
  lanAddr:  { letterSpacing: 1 },
  lanPin:   { letterSpacing: 2, fontSize: 18 },
  lanTimer: { color: Colors.textMuted },
  lanScanBox: { gap: Spacing.sm, marginBottom: Spacing.md },
});
