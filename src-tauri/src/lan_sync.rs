use axum::{
    body::Bytes,
    extract::State,
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

// ── Shared HTTP state ─────────────────────────────────────────────────────────

struct SyncState {
    pin:          String,
    local_bundle: String,
    received:     Mutex<Option<String>>,
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

fn verify_pin(headers: &HeaderMap, expected: &str) -> bool {
    headers
        .get("x-lan-pin")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == expected)
        .unwrap_or(false)
}

async fn handle_get(
    State(state): State<Arc<SyncState>>,
    headers: HeaderMap,
) -> Result<String, StatusCode> {
    if !verify_pin(&headers, &state.pin) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(state.local_bundle.clone())
}

async fn handle_put(
    State(state): State<Arc<SyncState>>,
    headers: HeaderMap,
    body: Bytes,
) -> StatusCode {
    if !verify_pin(&headers, &state.pin) {
        return StatusCode::UNAUTHORIZED;
    }
    match String::from_utf8(body.to_vec()) {
        Ok(s) if !s.is_empty() => {
            *state.received.lock().unwrap() = Some(s);
            StatusCode::OK
        }
        _ => StatusCode::BAD_REQUEST,
    }
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
        pin:          pin.clone(),
        local_bundle: bundle_json,
        received:     Mutex::new(None),
    });

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    // Spawn the HTTP server on Tauri's async runtime
    let server_state = sync_state.clone();
    tauri::async_runtime::spawn(async move {
        let app = Router::new()
            .route("/bundle", get(handle_get).put(handle_put))
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
