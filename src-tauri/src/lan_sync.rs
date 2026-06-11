use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
    routing::{get, put},
    Router,
};
use rand::{distributions::Alphanumeric, Rng};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tokio::{sync::oneshot, time::Duration};

const PIN_LEN: usize = 6;
const TIMEOUT_SECS: u64 = 300; // 5 minutes
const MAX_FAILED_PINS: u8 = 10;
// 512 MiB — mirrors MAX_BUNDLE_BYTES in SyncBundle.ts
const MAX_BODY_BYTES: usize = 512 * 1024 * 1024;

// ── Shared HTTP state ─────────────────────────────────────────────────────────

struct SyncState {
    pin:             String,
    local_bundle:    String,
    received:        Mutex<Option<String>>,
    failed_attempts: Mutex<u8>,
}

// ── Managed Tauri state ───────────────────────────────────────────────────────

struct ActiveSession {
    info:        LanSyncInfo,
    sync_state:  Arc<SyncState>,
    shutdown_tx: Mutex<Option<oneshot::Sender<()>>>,
}

pub struct LanSyncManager(pub Mutex<Option<ActiveSession>>);

impl LanSyncManager {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

/// Constant-time PIN comparison — prevents timing-oracle attacks on the local network.
fn verify_pin(headers: &HeaderMap, expected: &str) -> bool {
    let Some(provided) = headers.get("x-lan-pin").and_then(|v| v.to_str().ok()) else {
        return false;
    };
    let exp = expected.as_bytes();
    let got = provided.as_bytes();
    if got.len() != exp.len() {
        return false;
    }
    let mut differ: u8 = 0;
    for (a, b) in got.iter().zip(exp.iter()) {
        differ |= a ^ b;
    }
    differ == 0
}

fn check_pin_with_rate_limit(state: &SyncState, headers: &HeaderMap) -> Result<(), StatusCode> {
    {
        let fails = state.failed_attempts.lock().unwrap();
        if *fails >= MAX_FAILED_PINS {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    }
    if verify_pin(headers, &state.pin) {
        *state.failed_attempts.lock().unwrap() = 0;
        Ok(())
    } else {
        *state.failed_attempts.lock().unwrap() += 1;
        Err(StatusCode::UNAUTHORIZED)
    }
}

async fn handle_get(
    State(state): State<Arc<SyncState>>,
    headers: HeaderMap,
) -> Result<String, StatusCode> {
    check_pin_with_rate_limit(&state, &headers)?;
    Ok(state.local_bundle.clone())
}

async fn handle_put(
    State(state): State<Arc<SyncState>>,
    headers: HeaderMap,
    body: Bytes,
) -> StatusCode {
    if let Err(code) = check_pin_with_rate_limit(&state, &headers) {
        return code;
    }
    let Ok(s) = String::from_utf8(body.into()) else {
        return StatusCode::BAD_REQUEST;
    };
    if s.is_empty() {
        return StatusCode::BAD_REQUEST;
    }
    let mut received = state.received.lock().unwrap();
    if received.is_some() {
        // A bundle was already received — reject concurrent PUTs.
        return StatusCode::CONFLICT;
    }
    *received = Some(s);
    StatusCode::OK
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct LanSyncInfo {
    pub ip:   String,
    pub port: u16,
    pub pin:  String,
    pub url:  String,
}

#[tauri::command]
pub async fn lan_sync_start(
    bundle_json: String,
    manager: tauri::State<'_, LanSyncManager>,
) -> Result<LanSyncInfo, String> {
    // Stop any existing session
    {
        let mut lock = manager.0.lock().unwrap();
        if let Some(session) = lock.take() {
            if let Some(tx) = session.shutdown_tx.lock().unwrap().take() {
                let _ = tx.send(());
            }
        }
    }

    // Generate uppercase alphanumeric PIN
    let pin: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(PIN_LEN)
        .map(|c| (c as char).to_ascii_uppercase())
        .collect();

    // Discover LAN IP
    let ip = local_ip_address::local_ip()
        .map_err(|e| format!("Cannot determine local IP: {e}"))?
        .to_string();

    // Bind to OS-assigned port
    let listener = tokio::net::TcpListener::bind("0.0.0.0:0")
        .await
        .map_err(|e| format!("Cannot bind listener: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .port();

    let info = LanSyncInfo {
        url: format!("njlan://{}:{}?pin={}", ip, port, pin),
        ip: ip.clone(),
        port,
        pin: pin.clone(),
    };

    let sync_state = Arc::new(SyncState {
        pin:             pin.clone(),
        local_bundle:    bundle_json,
        received:        Mutex::new(None),
        failed_attempts: Mutex::new(0),
    });

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    // Spawn the HTTP server on Tauri's async runtime
    let server_state = sync_state.clone();
    tauri::async_runtime::spawn(async move {
        let app = Router::new()
            .route("/bundle", get(handle_get).put(handle_put))
            .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
            .with_state(server_state);

        let _ = axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                tokio::select! {
                    _ = shutdown_rx => {}
                    _ = tokio::time::sleep(Duration::from_secs(TIMEOUT_SECS)) => {}
                }
            })
            .await;
    });

    *manager.0.lock().unwrap() = Some(ActiveSession {
        info:        info.clone(),
        sync_state,
        shutdown_tx: Mutex::new(Some(shutdown_tx)),
    });

    Ok(info)
}

/// Poll for the merged bundle pushed by the mobile device.
/// Returns `Some(json)` after a successful PUT, `None` if still waiting.
#[tauri::command]
pub fn lan_sync_status(
    manager: tauri::State<'_, LanSyncManager>,
) -> Option<String> {
    manager
        .0
        .lock()
        .unwrap()
        .as_ref()
        .and_then(|s| s.sync_state.received.lock().unwrap().clone())
}

/// Stop the LAN sync server (cancel or after successful sync).
#[tauri::command]
pub fn lan_sync_stop(
    manager: tauri::State<'_, LanSyncManager>,
) -> Result<(), String> {
    let mut lock = manager.0.lock().unwrap();
    if let Some(session) = lock.take() {
        if let Some(tx) = session.shutdown_tx.lock().unwrap().take() {
            let _ = tx.send(());
        }
    }
    Ok(())
}
