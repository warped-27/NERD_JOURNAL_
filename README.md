# NERD_JOURNAL_

> Zero-knowledge encrypted personal journal for developers, hackers, and privacy enthusiasts.
> Brutalist terminal UI · Local-first AI · Cross-platform (iOS · Android · macOS · Windows · Linux)

---

## Philosophy

**Serverless. Client-Centric. Zero-Knowledge.**

There is no central database, no subscription, no proxy server. Your notes are encrypted on-device before they ever touch storage or the network. Your keys are yours. Your cloud is yours.

| Pillar | What it means |
|---|---|
| **Zero-Knowledge Encryption** | AES-256-GCM with a key derived via Argon2id from your master password. Notes never leave the device in plain text. |
| **Local-first AI** | Inference runs on-device (llama.rn) or on your own hardware (Ollama / Jan / LM Studio / MLX) — no cloud, no API keys, no consent dialogs. |
| **Wi-Fi Sync** | Sync instantly between your devices over Wi-Fi — no internet, no account, no third-party server. One QR code, one one-time code, done. |
| **BYO-Cloud** | When you want remote persistence, bring your own server: WebDAV, Nextcloud, ownCloud, or an encrypted file you move manually. |

---

## Features

### Interface
- Brutalist terminal aesthetic — `border-radius: 0`, phosphor-green accents, JetBrains Mono, CRT scanlines
- Responsive: single-column on mobile, two-panel sidebar layout on desktop (Tauri)
- Keyboard shortcuts on desktop (`⌘N` new note, `⌘K` ask AI, `⌘⌫` back)
- System tray integration on macOS / Windows / Linux

### Notes & Knowledge
- Full SQLite database, offline-first
- Full-text search across all notes (title + content)
- Auto-tagging, one-line summaries, and colour palette via AI (on save, optional)
- Related notes panel using TF-IDF cosine similarity (no embeddings, no cloud)
- Writing streak tracker, word count, sparkline activity chart
- Daily writing prompts
- Markdown export with YAML frontmatter

### AI — Local-First Cascade

AI requests flow through a local-first cascade — the first available provider wins:

```
llama.rn (on-device) → Ollama / Jan / LM Studio → MLX
```

| Provider | Privacy | Platform | Notes |
|---|---|---|---|
| **llama.rn** | 🟢 On-device | iOS · Android | User-selectable GGUF model — downloaded once, runs fully offline |
| **Ollama** | 🟢 Local | Desktop · Mobile (LAN IP) | Any Ollama model, e.g. `llama3.2:3b` |
| **Jan** | 🟢 Local | Desktop · Mobile (LAN IP) | OpenAI-compatible — `localhost:1337` by default |
| **LM Studio** | 🟢 Local | Desktop · Mobile (LAN IP) | OpenAI-compatible — `localhost:1234` by default |
| **MLX** | 🟢 Local | macOS Apple Silicon | `mlx_lm.server`, any MLX-compatible model |

All providers are **local-only** — note content never leaves your machine or LAN. No API keys. No consent dialogs. No cloud calls.

#### On-device model picker (iOS / Android)

Choose and swap the on-device GGUF model from Settings → On-Device Model. Models are downloaded once from HuggingFace and stored locally; multiple models can be downloaded simultaneously. The active model can be swapped without losing downloaded files.

| Model | Size | Notes |
|---|---|---|
| **Gemma 4 E2B** ✦ | ~3.7 GB | Google · MoE architecture · newest · best quality per active param |
| **Gemma 3 4B** | 2.5 GB | Google · proven default · best overall quality · solid multilingual |
| **Qwen 2.5 3B** | 1.9 GB | Alibaba · excellent multilingual · great for mixed-language notes |
| **Phi-4 Mini** | 2.5 GB | Microsoft · strong reasoning · 3.8B params in a compact package |

### Voice Transcription (Whisper)

| Platform | How it works |
|---|---|
| **iOS / Android** | Whisper Small (244 MB) runs entirely on the device — audio never leaves, works offline. Download once from Settings → Voice Transcription. |
| **Desktop (Tauri)** | Connect a local Whisper-compatible server. Recording uses the system microphone via the WebView MediaRecorder API. |

**Desktop setup options:**
```bash
# macOS Apple Silicon — whisper.cpp with Metal acceleration
whisper.cpp --server --model ggml-small.bin --port 8000

# Any platform — Docker
docker run -p 8000:8000 fedirz/faster-whisper-server
```

Configure the server URL in Settings → Voice Transcription — Desktop. Recording always works; transcription is optional and requires the server to be running.

### Second Brain (RAG)
Ask questions across your entire note collection via the **Second Brain** screen. TF-IDF retrieval selects the most relevant notes, builds a context window, and queries the active AI provider — no embeddings, no third-party vector store. Answers include collapsible source citations.

### Sync

| Method | Details |
|---|---|
| **Wi-Fi Sync** | One-step sync between desktop and mobile on the same Wi-Fi — no internet, no account |
| **WebDAV / Nextcloud / ownCloud** | Push/pull of encrypted bundle, ETag-based conditional sync (skips download if unchanged) |
| **File backup** | Export/import encrypted backup manually |

All sync methods:
- Transfer only AES-256-GCM encrypted envelopes — the server never sees plaintext
- Detect cross-vault bundles (salt mismatch) and reject them before import
- Wrap all imports in a SQLite transaction — a crash mid-import leaves the DB clean
- Last-writer-wins merge with per-note conflict detection and user-facing resolution UI
- Delta push: skips upload if nothing changed since last sync

#### Wi-Fi Sync — how it works

1. Tap **START WI-FI SYNC** on the desktop — an Axum HTTP server starts on a random port, a one-time 6-character code is generated, and a QR code appears on screen.
2. Tap **SCAN QR CODE** on the mobile app — the camera reads the QR code; the device connects directly to the desktop over the local network.
3. The mobile pulls the desktop's encrypted bundle, merges it locally, then pushes the merged result back. Both devices end up in sync in a single round-trip.
4. The server shuts down automatically after 5 minutes or as soon as the exchange completes.

**Security:** the bundle is AES-256-GCM encrypted at the application layer before it travels over HTTP. The one-time code uses constant-time comparison and is locked after 10 failed attempts (429). A 512 MiB body-size cap on the Axum router prevents RAM exhaustion. On iOS, `NSAllowsLocalNetworking` permits HTTP to LAN addresses. On Android, `android:usesCleartextTraffic` is set via a build-time config plugin — justified by application-layer encryption. Any QR code pointing to a non-RFC-1918 address is rejected before a single byte is sent (SSRF guard).

### Security
- Vault unlock: master password (always) + optional Face ID / Fingerprint (iOS / Android)
- Biometric key stored in device Secure Enclave — never leaves hardware; requires passcode to be set
- OS keychain on desktop (Rust `keyring` crate via Tauri IPC)
- Derived key zeroed in memory immediately on lock or on any exception path
- `toBase64url` uses chunk-based encoding — no stack overflow on large notes or attachments
- Sync credentials (`nj_sync_config`) stored in sessionStorage on web — not persisted across browser restarts
- Content Security Policy locks outbound connections to model-download and local endpoints only
- All WebDAV fetch calls use `redirect: 'manual'` to prevent credential forwarding
- Wi-Fi sync: SSRF guard rejects QR codes pointing outside RFC-1918 / loopback; constant-time PIN; rate-limited to 10 attempts; 512 MiB body cap; 409 on concurrent PUT
- Link attachments from synced bundles are validated against `http/https` scheme before `Linking.openURL`
- Attachment shapes validated after decryption (type enum + link URL scheme check)
- Prompt injection sanitisation: NFKC normalisation, zero-width char stripping, pattern removal before AI calls

---

## Platform Support

| Platform | Status | How to run | Native capabilities |
|---|---|---|---|
| **Desktop (Tauri)** | ✅ Full | `npm run dev:tauri` | OS keychain · file pickers · tray · keyboard shortcuts · Wi-Fi sync server · voice recording |
| **iOS** | ✅ Full | EAS build or `npx expo run:ios` | llama.rn · Whisper STT · biometrics · camera · Wi-Fi sync QR scanner · voice recording |
| **Android** | ✅ Full | EAS build or `npx expo run:android` | llama.rn · Whisper STT · biometrics · camera · Wi-Fi sync QR scanner · voice recording |
| **Web (browser)** | ❌ Not supported | `npm run web` | See note below |

> **Web browser — not supported for end users.**
> The vault requires an OS keychain (Tauri) or device secure enclave (iOS / Android) to store the KDF salt and verifier. Browsers have neither: writing these keys via `webSet()` throws immediately with *"Vault storage requires a secure keychain"*. The web build exists for UI development only — the app is unusable without an unlocked vault.

> **Other platform notes:**
> - Ollama / Jan / LM Studio on mobile: `localhost` refers to the phone itself. Use the computer's LAN IP (e.g. `http://192.168.1.x:11434`) or Tailscale.
> - MLX: macOS Apple Silicon only. Not available on iOS, Android, or Intel Macs.
> - Whisper STT (on-device): iOS and Android native builds only. Desktop uses a local Whisper server instead.
> - Wi-Fi sync server: desktop (Tauri) only. Mobile acts as client and scans the QR code. Both devices must be on the same Wi-Fi network.

---

## Getting Started

### Desktop (Tauri) — recommended starting point

Requires [Rust](https://rustup.rs) and Tauri system dependencies for your OS.
The project pins the exact Rust version in `rust-toolchain.toml` — `rustup` installs it automatically on first build.

```bash
# macOS / Linux (one-time)
curl https://sh.rustup.rs -sSf | sh

# Windows (one-time) — download and run rustup-init.exe from rustup.rs
# Choose "MSVC" toolchain when prompted (default). Add to PATH when asked.
# Visual Studio Build Tools 2022+ with "Desktop development with C++" is required.

# Linux — additional system deps
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev

# Dev mode (hot-reload)
npm run dev:tauri

# Production build (.dmg / .msi / .deb / .AppImage)
npm run build:tauri
```

### Mobile (iOS / Android)

**EAS cloud build** (no local toolchain required):

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android   # .apk
eas build --profile development --platform ios       # requires Apple Developer account
```

**Local Android build**:

```bash
npx expo prebuild --platform android
npx expo run:android
```

**Local iOS build** (requires Xcode 15+):

```bash
npx expo prebuild --platform ios
npx expo run:ios
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo 56 + React Native 0.85 + React 19 |
| Desktop wrapper | Tauri v2 (Rust) |
| Navigation | Expo Router (file-based) |
| Database | expo-sqlite (SQLite, on-device) |
| Encryption | AES-256-GCM (`@noble/ciphers`) · Argon2id KDF (`@noble/hashes`) |
| On-device LLM | llama.rn 0.12.4 (iOS / Android) |
| On-device STT | whisper.rn (iOS / Android) · Whisper server client (desktop) |
| Wi-Fi sync server | Axum 0.7 (Rust, desktop only) |
| QR generation | qrcode (desktop web renderer) |
| QR scanning | expo-camera + CameraView (iOS / Android) |
| Voice recording | expo-audio (all platforms) |
| Similarity search | TF-IDF cosine similarity (no external service) |
| State | Zustand + React Context |
| Styling | React Native StyleSheet — JetBrains Mono, design tokens |
| Tests | Jest + jest-expo (355 tests, 47 suites) |
| Type checking | TypeScript 6 (strict) |

---

## Project Structure

```
app/                  Expo Router screens
  (tabs)/index.tsx    Home — note list
  brain.tsx           Second Brain — RAG chat over notes
  note/[id].tsx       Note editor
  settings.tsx        Settings — AI, sync, security, voice

src/
  ai/                 AI providers, RAG, enrichment, TF-IDF
    providers/        openAiCompat · llamaRn
    whisper/          Whisper STT context + model manager (native)
                      whisperServerClient.ts — POST /v1/audio/transcriptions (desktop)
    onDevice/         llama.rn context + model picker (native)
  crypto/             Vault (AES-GCM + Argon2id), biometrics, keychain
  notes/              Note model, store, search, related notes
  sync/               WebDAV sync, Wi-Fi sync, file export/import, encrypted bundle
    providers/        webdavSync · lanSync
  stats/              Streak, word count, sparkline, daily prompts
  design/             Design tokens, Box, T, Btn, Input components
  platform/           isTauri() / isNative() detection
  lib/                URL validation, logger, Result type

src-tauri/            Rust — OS keychain IPC, system tray, file pickers, Wi-Fi sync server
  src/lan_sync.rs     Axum HTTP server (GET/PUT /bundle), constant-time PIN, rate-limit, graceful shutdown
  Info.plist          macOS NSMicrophoneUsageDescription for voice recording

plugins/              Expo config plugins (applied at EAS / prebuild time)
  withAndroidLanNetwork.js  Sets android:usesCleartextTraffic for LAN HTTP
```

---

## Scripts

```bash
npm run web           # Expo web dev server (UI development only — vault unusable in browser)
npm run dev:tauri     # Tauri desktop dev mode
npm run build:tauri   # Tauri production build
npm test              # Jest (355 tests, 47 suites)
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
```

---

## License

MIT
