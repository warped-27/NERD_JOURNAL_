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
| **LAN Sync** | Sync instantly between your devices over Wi-Fi — no internet, no account, no third-party server. One QR code, one PIN, done. |
| **BYO-Cloud** | When you want remote persistence, bring your own server: WebDAV, Nextcloud, ownCloud, or an encrypted file you move manually. |

---

## Features

### Interface
- Brutalist terminal aesthetic — `border-radius: 0`, phosphor-green accents, JetBrains Mono, CRT scanlines
- Responsive: single-column on mobile, two-panel sidebar layout on desktop (Tauri)
- Keyboard shortcuts on desktop (`⌘N` new note, `⌘K` ask, `⌘⌫` back)
- System tray integration on macOS / Windows / Linux

### Notes & Knowledge
- Full SQLite database, offline-first
- Full-text search across all notes (title + content)
- Auto-tagging, bullet-point summaries, and semantic enrichment via AI (on save)
- Related notes panel using TF-IDF cosine similarity (no embeddings, no cloud)
- Writing streak tracker, word count, sparkline activity chart
- Daily writing prompts
- Markdown export with YAML frontmatter (via system share sheet)

### AI — Local-First Cascade

AI requests flow through a local-first cascade — the first available provider wins:

```
llama.rn (on-device) → Ollama / Jan / LM Studio → MLX
```

| Provider | Privacy | Platform | Notes |
|---|---|---|---|
| **llama.rn** | 🟢 On-device | iOS · Android | Gemma 3 4B Q4_K_M — fully offline |
| **Ollama** | 🟢 Local | Desktop · Mobile (LAN IP) | Any Ollama model, e.g. `llama3.2:3b` |
| **Jan** | 🟢 Local | Desktop · Mobile (LAN IP) | OpenAI-compatible — `localhost:1337` by default |
| **LM Studio** | 🟢 Local | Desktop · Mobile (LAN IP) | OpenAI-compatible — `localhost:1234` by default |
| **MLX** | 🟢 Local | macOS Apple Silicon | `mlx_lm.server`, any MLX-compatible model |

All providers are **local-only** — note content never leaves your machine or LAN. No API keys. No consent dialogs. No cloud calls.

The Ollama slot in Settings accepts any OpenAI-compatible local runtime: Ollama, Jan, LM Studio, or any other server that speaks the `/v1/chat/completions` API.

### Voice Transcription (Whisper)
- **On-device** (iOS / Android): Whisper Small (244 MB, downloaded once from HuggingFace `ggerganov/whisper.cpp`) — audio never leaves the device, works fully offline
- **Desktop / Web**: unavailable — shown with a clear "macOS / iOS / Android only" notice in Settings

### Second Brain (RAG)
Ask questions across your entire note collection via the dedicated **Second Brain** screen. TF-IDF retrieval selects the most relevant notes, builds a context window, and queries the active AI provider — no embeddings, no third-party vector store. Answers include collapsible source citations.

### Sync

| Method | Details |
|---|---|
| **LAN Sync** | One-command sync between desktop and mobile on the same Wi-Fi — no internet, no account |
| **WebDAV / Nextcloud / ownCloud** | Push/pull of encrypted bundle, ETag-based conditional sync (skips download if unchanged) |
| **File backup** | Export/import encrypted `.njvault` bundle manually |

All sync methods:
- Transfer only AES-256-GCM encrypted envelopes — the server never sees plaintext
- Detect cross-vault bundles (salt mismatch) and reject them before import
- Wrap all imports in a SQLite transaction — a crash mid-import leaves the DB clean
- Last-writer-wins merge with per-note conflict detection and user-facing resolution UI
- Delta push: skips upload if nothing changed since last sync

#### LAN Sync — how it works

1. Tap **START LAN SYNC** on the desktop — an Axum HTTP server starts on a random port, a one-time 6-character PIN is generated, and a QR code appears on screen.
2. Tap **SCAN QR** on the mobile app — the camera reads the QR code; the device connects directly to the desktop over the local network.
3. The mobile pulls the desktop's encrypted bundle, merges it locally, then pushes the merged result back. Both devices end up in sync in a single round-trip.
4. The server shuts down automatically after 5 minutes or as soon as the exchange completes.

**Security:** the bundle is AES-256-GCM encrypted at the application layer before it travels over HTTP. The one-time PIN uses constant-time comparison and is locked after 10 failed attempts (429). A 512 MiB body-size cap on the Axum router prevents RAM exhaustion. On iOS, `NSAllowsLocalNetworking` permits HTTP to LAN addresses. On Android, `android:usesCleartextTraffic` is set via a build-time config plugin — justified by application-layer encryption. Any QR code pointing to a non-RFC-1918 address is rejected before a single byte is sent (SSRF guard).

### Security
- Vault unlock: master password (always) + optional Face ID / Fingerprint (iOS / Android)
- Biometric key stored in device Secure Enclave — never leaves hardware; requires passcode to be set
- OS keychain on desktop (Rust `keyring` crate via Tauri IPC)
- Derived key zeroed in memory immediately on lock or on any exception path
- `toBase64url` uses chunk-based encoding — no stack overflow on large notes or attachments
- Sync credentials (`nj_sync_config`) stored in sessionStorage on web — not persisted across browser restarts
- Content Security Policy locks outbound connections to model-download and local endpoints only
- All WebDAV fetch calls use `redirect: 'manual'` to prevent credential forwarding
- LAN sync: SSRF guard rejects QR codes pointing outside RFC-1918 / loopback; constant-time PIN; rate-limited to 10 attempts; 512 MiB body cap; 409 on concurrent PUT
- Link attachments from synced bundles are validated against `http/https` scheme before `Linking.openURL`
- Attachment shapes validated after decryption (type enum + link URL scheme check)
- Prompt injection sanitisation: NFKC normalisation, zero-width char stripping, pattern removal before AI calls

---

## Platform Support

| Platform | Status | How to run | Notes |
|---|---|---|---|
| **Desktop (Tauri)** | ✅ Full | `npm run dev:tauri` | OS keychain · file pickers · tray · keyboard shortcuts · LAN sync server |
| **iOS** | ✅ Full | EAS build or `npx expo run:ios` | llama.rn · Whisper · biometrics · camera · LAN sync QR scanner |
| **Android** | ✅ Full | EAS build or `npx expo run:android` | llama.rn · Whisper · biometrics · camera · LAN sync QR scanner |
| **Web (browser)** | ❌ Not supported | `npm run web` | See note below |

> **Web browser — not supported for end users.**
> The vault requires an OS keychain (Tauri) or device secure enclave (iOS / Android) to store the KDF salt and verifier. Browsers have neither: writing these keys via `webSet()` throws immediately with *"Vault storage requires a secure keychain"*. The web build exists for UI development only — the app is unusable without an unlocked vault.

> **Other platform notes:**
> - Ollama / Jan / LM Studio on mobile: `localhost` refers to the phone itself. Use the computer's LAN IP (e.g. `http://192.168.1.x:11434`) or Tailscale.
> - MLX: macOS Apple Silicon only. Not available on iOS, Android, or Intel Macs.
> - Whisper STT: iOS and Android native builds only.
> - LAN sync server: desktop (Tauri) only. Mobile acts as client and scans the QR code. Both devices must be on the same Wi-Fi network.

---

## Getting Started

### Desktop (Tauri) — recommended starting point

Requires [Rust](https://rustup.rs) and Tauri system dependencies for your OS.

```bash
# macOS / Linux (one-time)
curl https://sh.rustup.rs -sSf | sh

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
| On-device LLM | llama.rn (iOS / Android) |
| On-device STT | whisper.rn (iOS / Android) |
| LAN sync server | Axum 0.7 (Rust, desktop only) |
| QR generation | qrcode (desktop web renderer) |
| QR scanning | expo-camera + CameraView (iOS / Android) |
| Similarity search | TF-IDF cosine similarity (no external service) |
| State | Zustand + React Context |
| Styling | React Native StyleSheet — JetBrains Mono, design tokens |
| Tests | Jest + jest-expo (343 tests, 46 suites) |
| Type checking | TypeScript 6 (strict) |

---

## Project Structure

```
app/                  Expo Router screens
  (tabs)/index.tsx    Home — note list
  brain.tsx           Second Brain — RAG chat over notes
  note/[id].tsx       Note editor
  settings.tsx        Settings — AI, sync, security

src/
  ai/                 AI providers, RAG, enrichment, TF-IDF
    providers/        openAiCompat · llamaRn
    whisper/          Whisper STT context + model manager (native only)
    onDevice/         llama.rn context + model manager (native only)
  crypto/             Vault (AES-GCM + Argon2id), biometrics, keychain
  notes/              Note model, store, search, related notes
  sync/               WebDAV sync, LAN sync, file export/import, encrypted bundle
    providers/        webdavSync · lanSync
  stats/              Streak, word count, sparkline, daily prompts
  design/             Design tokens, Box, T, Btn, Input components
  platform/           isTauri() / isNative() detection
  lib/                URL validation, logger, Result type

src-tauri/            Rust — OS keychain IPC, system tray, file pickers, LAN sync server
  src/lan_sync.rs     Axum HTTP server (GET/PUT /bundle), constant-time PIN, rate-limit, graceful shutdown

plugins/              Expo config plugins (applied at EAS / prebuild time)
  withAndroidLanNetwork.js  Sets android:usesCleartextTraffic for LAN HTTP
```

---

## Scripts

```bash
npm run web           # Expo web dev server (UI development only — vault unusable in browser)
npm run dev:tauri     # Tauri desktop dev mode
npm run build:tauri   # Tauri production build
npm test              # Jest (343 tests, 46 suites)
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
```

---

## License

MIT
