import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { isNativePlatform } from '../src/platform/detect';
import { useVault } from '../src/crypto/VaultContext';
import { useAi, GEMINI_MODELS } from '../src/ai/AiContext';
import { useOnDevice } from '../src/ai/onDevice/OnDeviceContext';
import { useWhisper } from '../src/ai/whisper/WhisperContext';
import { testOpenAiCompatConnection } from '../src/ai/providers/openAiCompatProvider';
import { testClaudeConnection, CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL } from '../src/ai/providers/claudeProvider';
import { useSync } from '../src/sync/SyncContext';
import { useNotes } from '../src/notes/NotesContext';
import { webdavPush, webdavPull, testWebDavConnection } from '../src/sync/providers/webdavSync';
import { s3Push, s3Pull, testS3Connection, type S3Config } from '../src/sync/providers/s3Sync';
import { exportToFile, importFromFile } from '../src/sync/providers/fileSync';
import { classifySyncError } from '../src/sync/syncError';
import { bundleToMarkdown } from '../src/export/markdownExport';
import { saveTextFile } from '../src/platform/fileSystem';
import { ConflictResolutionModal } from '../src/components/ConflictResolutionModal';
import { Box } from '../src/design/components/Box';
import { T } from '../src/design/components/T';
import { Input } from '../src/design/components/Input';
import { Btn } from '../src/design/components/Btn';
import { Colors, Spacing } from '../src/design/tokens';

const OPENAI_COMPAT_PRESETS = [
  { label: 'OPENAI',     baseUrl: 'https://api.openai.com',    model: 'gpt-4o-mini',          name: 'OpenAI' },
  { label: 'GROK',       baseUrl: 'https://api.x.ai',          model: 'grok-3-mini',          name: 'Grok (xAI)' },
  { label: 'MISTRAL',    baseUrl: 'https://api.mistral.ai',    model: 'mistral-small-latest', name: 'Mistral' },
  { label: 'PERPLEXITY', baseUrl: 'https://api.perplexity.ai', model: 'sonar',                name: 'Perplexity' },
] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const vault    = useVault();
  const ai       = useAi();
  const onDevice = useOnDevice();
  const whisper  = useWhisper();
  const sync     = useSync();
  const notes = useNotes();
  const [key,   setKey]   = useState(ai.apiKey ?? '');
  const [saved, setSaved] = useState(false);

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

  // Custom provider form state
  const [customEnabled, setCustomEnabled] = useState(ai.customConfig.enabled);
  const [customUrl,     setCustomUrl]     = useState(ai.customConfig.baseUrl);
  const [customModel,   setCustomModel]   = useState(ai.customConfig.model);
  const [customName,    setCustomName]    = useState(ai.customConfig.name);
  const [customApiKey,  setCustomApiKey]  = useState(ai.customConfig.apiKey ?? '');
  const [customTesting, setCustomTesting] = useState(false);
  const [customStatus,  setCustomStatus]  = useState('');

  // Claude form state
  const [claudeEnabled, setClaudeEnabled] = useState(ai.claudeConfig.enabled);
  const [claudeApiKey,  setClaudeApiKey]  = useState(ai.claudeConfig.apiKey);
  const [claudeModel,   setClaudeModel]   = useState(ai.claudeConfig.model || DEFAULT_CLAUDE_MODEL);
  const [claudeTesting, setClaudeTesting] = useState(false);
  const [claudeStatus,  setClaudeStatus]  = useState('');

  // WebDAV form state (seeded from stored config)
  const wdCfg  = sync.config.provider === 'webdav' ? sync.config.webdav : undefined;
  const [wdUrl,      setWdUrl]      = useState(wdCfg?.url      ?? '');
  const [wdUser,     setWdUser]     = useState(wdCfg?.username  ?? '');
  const [wdPass,     setWdPass]     = useState(wdCfg?.password  ?? '');
  const [wdTesting,  setWdTesting]  = useState(false);
  const [wdSyncing,  setWdSyncing]  = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  // S3 form state (seeded from stored config)
  const s3Cfg = sync.config.provider === 's3' ? sync.config.s3 : undefined;
  const [s3Endpoint,  setS3Endpoint]  = useState(s3Cfg?.endpoint  ?? '');
  const [s3Region,    setS3Region]    = useState(s3Cfg?.region     ?? 'auto');
  const [s3Bucket,    setS3Bucket]    = useState(s3Cfg?.bucket     ?? '');
  const [s3AccessKey, setS3AccessKey] = useState(s3Cfg?.accessKey  ?? '');
  const [s3SecretKey, setS3SecretKey] = useState(s3Cfg?.secretKey  ?? '');
  const [s3Testing,   setS3Testing]   = useState(false);
  const [s3Syncing,   setS3Syncing]   = useState(false);

  // Biometric status
  const [bioLoading, setBioLoading] = useState(false);
  const [bioStatus,  setBioStatus]  = useState('');

  async function handleSave() {
    await ai.setApiKey(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClear() {
    await ai.clearApiKey();
    setKey('');
  }

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

  async function handleCustomSave() {
    const url = customUrl.trim();
    if (!url) return;
    setCustomTesting(true);
    setCustomStatus('');
    try {
      if (customEnabled) await testOpenAiCompatConnection(url, customApiKey.trim() || undefined);
      await ai.setCustomConfig({
        enabled: customEnabled,
        baseUrl: url,
        model:   customModel.trim(),
        name:    customName.trim() || 'Custom',
        apiKey:  customApiKey.trim(),
      });
      setCustomStatus(customEnabled ? 'Custom provider configured ✓' : 'Custom provider disabled ✓');
    } catch (e) {
      setCustomStatus(e instanceof Error ? e.message : 'Connection test failed');
    } finally {
      setCustomTesting(false);
    }
  }

  async function handleClaudeSave() {
    const key = claudeApiKey.trim();
    if (!key) { setClaudeStatus('API key is required'); return; }
    setClaudeTesting(true);
    setClaudeStatus('');
    try {
      if (claudeEnabled) await testClaudeConnection(key, claudeModel);
      await ai.setClaudeConfig({ enabled: claudeEnabled, apiKey: key, model: claudeModel });
      setClaudeStatus(claudeEnabled ? 'Claude configured ✓' : 'Claude disabled ✓');
    } catch (e) {
      setClaudeStatus(e instanceof Error ? e.message : 'Connection test failed');
    } finally {
      setClaudeTesting(false);
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

      // 1. Conditional pull — skip download if remote bundle hasn't changed
      const pullResult = await webdavPull(cfg, sync.lastEtag);
      let newEtag = sync.lastEtag;

      if (pullResult === null && sync.lastEtag) {
        // 304 Not Modified — remote unchanged, nothing to merge
        setSyncStatus('Remote up to date');
      } else if (pullResult) {
        const mergeResult = await notes.importBundle(pullResult.bundle);
        newEtag = pullResult.etag;
        if (mergeResult.conflicts.length > 0) {
          sync.setPendingConflicts(mergeResult.conflicts);
        }
      }

      // 2. Conditional push — skip upload if nothing changed locally since last sync
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

  // ─── S3 handlers ──────────────────────────────────────────────────────────

  async function handleS3Save() {
    const endpoint = s3Endpoint.trim();
    const bucket   = s3Bucket.trim();
    if (!endpoint || !bucket) return;
    setS3Testing(true);
    setSyncStatus('');
    const cfg: S3Config = {
      endpoint, region: s3Region.trim() || 'auto',
      bucket, accessKey: s3AccessKey.trim(), secretKey: s3SecretKey.trim(),
    };
    try {
      await testS3Connection(cfg);
      await sync.setConfig({ provider: 's3', s3: cfg });
      setSyncStatus('S3 configured ✓');
    } catch (e) {
      setSyncStatus(classifySyncError(e));
    } finally {
      setS3Testing(false);
    }
  }

  async function handleS3SyncNow() {
    if (sync.config.provider !== 's3' || !sync.config.s3) return;
    setS3Syncing(true);
    setSyncStatus('');
    try {
      const cfg    = sync.config.s3;
      const result = await s3Pull(cfg);
      if (result) {
        const mergeResult = await notes.importBundle(result.bundle);
        if (mergeResult.conflicts.length > 0) sync.setPendingConflicts(mergeResult.conflicts);
      }
      const merged = await notes.exportBundle();
      await s3Push(cfg, merged);
      sync.setLastSyncAt(Date.now());
      setSyncStatus('S3 sync complete ✓');
    } catch (e) {
      const msg = classifySyncError(e);
      setSyncStatus(msg);
      sync.setLastError(msg);
    } finally {
      setS3Syncing(false);
    }
  }

  async function handleDisconnectS3() {
    await sync.setConfig({ provider: 'none' });
    setSyncStatus('S3 disconnected');
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

        {ai.autoEnrich && ai.hasCloudProvider && onDevice.status !== 'loaded' && (
          <T variant="error" style={styles.privacyWarning} testID="autoenrich-warning">
            Note content is sent to {ai.cloudProviderName ?? 'cloud AI'} automatically on
            every save. Load the on-device model to keep notes local.
          </T>
        )}

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

            {/* Status badge */}
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

            {/* Actions */}
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
          before any cloud fallback. Your notes never leave the device.
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

        {/* ─── CUSTOM PROVIDER ─── */}
        <T variant="label" style={[styles.label, styles.modelTitle]}>CUSTOM (LITELLM / OPENAI-COMPATIBLE)</T>
        <T variant="muted" style={styles.hint}>
          Point to any OpenAI-compatible endpoint. Use quick-setup presets for cloud
          providers, or enter a custom URL for LiteLLM, vLLM, LocalAI, or similar.
        </T>

        {/* Quick-setup presets */}
        <T variant="caption" style={styles.presetsLabel}>QUICK SETUP:</T>
        <View style={styles.presetsRow}>
          {OPENAI_COMPAT_PRESETS.map((p) => (
            <Pressable
              key={p.label}
              style={[styles.presetChip, customUrl === p.baseUrl && styles.presetChipActive]}
              onPress={() => { setCustomUrl(p.baseUrl); setCustomModel(p.model); setCustomName(p.name); }}
              testID={`custom-preset-${p.label.toLowerCase()}`}
            >
              <T variant="kicker" style={customUrl === p.baseUrl ? styles.presetChipTextActive : styles.presetChipText}>
                {p.label}
              </T>
            </Pressable>
          ))}
        </View>

        <Input
          value={customName}
          onChangeText={setCustomName}
          placeholder="Custom (LiteLLM / OpenAI-compatible)"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          testID="custom-name"
        />
        <Input
          value={customApiKey}
          onChangeText={setCustomApiKey}
          placeholder="API key (leave blank for local servers)"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          testID="custom-apikey"
        />
        <Pressable
          style={[styles.toggleRow, customEnabled && styles.toggleRowActive]}
          onPress={() => setCustomEnabled(!customEnabled)}
          accessibilityRole="switch"
          accessibilityState={{ checked: customEnabled }}
          testID="custom-toggle"
        >
          <View style={[styles.radio, customEnabled && styles.radioActive]} />
          <T variant={customEnabled ? 'label' : 'muted'} style={styles.modelLabel}>
            {customEnabled ? 'ENABLED' : 'DISABLED'}
          </T>
        </Pressable>
        <Input
          value={customUrl}
          onChangeText={setCustomUrl}
          placeholder="http://localhost:4000"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
          testID="custom-url"
        />
        <Input
          value={customModel}
          onChangeText={setCustomModel}
          placeholder="gpt-4o-mini"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          testID="custom-model"
        />
        <Btn
          label={customTesting ? 'TESTING…' : 'SAVE CUSTOM'}
          variant="primary"
          onPress={handleCustomSave}
          loading={customTesting}
          style={[styles.btn, styles.fullBtn]}
          testID="custom-save"
        />
        {customStatus ? (
          <T
            variant={customStatus.includes('✓') ? 'label' : 'error'}
            style={[styles.status, styles.sectionGap]}
            testID="custom-status"
          >
            {customStatus}
          </T>
        ) : null}

        {/* ─── CLAUDE ─── */}
        <T variant="heading" style={[styles.section, styles.syncHeading]}>CLOUD AI — CLAUDE</T>
        <T variant="muted" style={styles.hint}>
          Anthropic Claude — privacy-conscious cloud AI. Uses a different API format
          from OpenAI-compatible providers. Your notes are sent to Anthropic when used.
          Get an API key at console.anthropic.com
        </T>

        <Input
          value={claudeApiKey}
          onChangeText={setClaudeApiKey}
          placeholder="sk-ant-…"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          testID="claude-apikey"
        />

        <Pressable
          style={[styles.toggleRow, claudeEnabled && styles.toggleRowActive]}
          onPress={() => setClaudeEnabled(!claudeEnabled)}
          accessibilityRole="switch"
          accessibilityState={{ checked: claudeEnabled }}
          testID="claude-toggle"
        >
          <View style={[styles.radio, claudeEnabled && styles.radioActive]} />
          <T variant={claudeEnabled ? 'label' : 'muted'} style={styles.modelLabel}>
            {claudeEnabled ? 'ENABLED' : 'DISABLED'}
          </T>
        </Pressable>

        <T variant="label" style={styles.label}>MODEL</T>
        {CLAUDE_MODELS.map((m) => {
          const active = claudeModel === m.id;
          return (
            <Pressable
              key={m.id}
              style={[styles.modelRow, active && styles.modelRowActive]}
              onPress={() => setClaudeModel(m.id)}
              testID={`claude-model-${m.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.radio, active && styles.radioActive]} />
              <T variant={active ? 'label' : 'muted'} style={styles.modelLabel}>{m.label}</T>
            </Pressable>
          );
        })}

        <Btn
          label={claudeTesting ? 'TESTING…' : 'SAVE CLAUDE'}
          variant="primary"
          onPress={handleClaudeSave}
          loading={claudeTesting}
          style={[styles.btn, styles.fullBtn]}
          testID="claude-save"
        />
        {claudeStatus ? (
          <T
            variant={claudeStatus.includes('✓') ? 'label' : 'error'}
            style={[styles.status, styles.sectionGap]}
            testID="claude-status"
          >
            {claudeStatus}
          </T>
        ) : null}

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

        {/* S3 form */}
        <T variant="label" style={[styles.label, styles.modelTitle]}>S3-COMPATIBLE (AWS / R2 / B2 / MINIO)</T>
        <T variant="muted" style={styles.hint}>
          Works with AWS S3, Cloudflare R2, Backblaze B2, and any S3-compatible storage.
          Your vault is encrypted before upload — credentials and data are never exposed.
        </T>
        <Input
          value={s3Endpoint}
          onChangeText={setS3Endpoint}
          placeholder="https://s3.amazonaws.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
          testID="sync-s3-endpoint"
        />
        <Input
          value={s3Region}
          onChangeText={setS3Region}
          placeholder="us-east-1 (or 'auto' for R2)"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          testID="sync-s3-region"
        />
        <Input
          value={s3Bucket}
          onChangeText={setS3Bucket}
          placeholder="my-journal-bucket"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          testID="sync-s3-bucket"
        />
        <Input
          value={s3AccessKey}
          onChangeText={setS3AccessKey}
          placeholder="access key ID"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          testID="sync-s3-access-key"
        />
        <Input
          value={s3SecretKey}
          onChangeText={setS3SecretKey}
          placeholder="secret access key"
          secureTextEntry
          style={styles.input}
          testID="sync-s3-secret-key"
        />
        <View style={styles.actions}>
          <Btn
            label={s3Testing ? 'TESTING…' : 'TEST & SAVE'}
            variant="primary"
            onPress={handleS3Save}
            loading={s3Testing}
            style={styles.btn}
            testID="sync-s3-save"
          />
          {sync.config.provider === 's3' && (
            <Btn
              label={s3Syncing ? 'SYNCING…' : 'SYNC NOW'}
              variant="ghost"
              onPress={handleS3SyncNow}
              loading={s3Syncing}
              style={styles.btn}
              testID="sync-s3-now"
            />
          )}
        </View>
        {sync.config.provider === 's3' && (
          <>
            <T variant="muted" style={styles.status}>
              {sync.lastSyncAt
                ? `Last sync: ${new Date(sync.lastSyncAt).toLocaleString()}`
                : 'Never synced on this session'}
            </T>
            <Btn
              label="DISCONNECT S3"
              variant="danger"
              onPress={handleDisconnectS3}
              style={[styles.btn, styles.disconnectBtn]}
              testID="sync-s3-disconnect"
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
  modelLabel:     { flex: 1 },
  syncHeading:    { marginTop: Spacing.xl, marginBottom: Spacing.sm },
  warnBadge:      { color: Colors.warning, fontSize: 11 },
  warnText:       { color: Colors.warning },
  privacyWarning: { color: Colors.error, marginBottom: Spacing.md, lineHeight: 18 },
  disconnectBtn:  { marginTop: Spacing.xs },
  fullBtn:        { alignSelf: 'stretch' },
  sectionGap:     { marginBottom: Spacing.md },
  presetsLabel:   { marginBottom: Spacing.xs, color: Colors.textMuted },
  presetsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.xs,
    marginBottom:  Spacing.md,
  },
  presetChip: {
    borderWidth:       1,
    borderColor:       Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   4,
  },
  presetChipActive: {
    borderColor:     Colors.green,
    backgroundColor: Colors.greenBg,
  },
  presetChipText:       { color: Colors.textMuted },
  presetChipTextActive: { color: Colors.green },
});
