mod lan_sync;
use lan_sync::LanSyncManager;

use keyring::{Entry, Error as KeyringError};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

const KEYRING_SERVICE: &str = "nerd_journal";

/// Allowlist of every key the JS layer is permitted to read/write/delete.
/// Any key not in this list is rejected to prevent arbitrary keychain enumeration
/// by injected content running in the WebView.
const ALLOWED_KEYS: &[&str] = &[
    "nj_vault_salt",
    "nj_vault_verifier",
    "nj_ai_autoenrich",
    "nj_ollama_config",
    "nj_mlx_config",
    "nj_sync_config",
    "nj_sync_meta",
    "nj_device_id",
    "nj_ondevice_model",
    "nj_biometric_enabled",
    "nj_whisper_server_config",
    // Legacy keys kept for one-time migration reads/deletes
    "nj_gemini_autoenrich",
];

fn validate_key(key: &str) -> Result<(), String> {
    if ALLOWED_KEYS.contains(&key) {
        Ok(())
    } else {
        Err(format!("Unknown secret key"))
    }
}

/// Retrieve a secret from the OS keychain.
/// Returns `None` if no entry exists for this key (not an error).
#[tauri::command]
fn get_secret(key: String) -> Result<Option<String>, String> {
    validate_key(&key)?;
    let entry = Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(val)                    => Ok(Some(val)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(e)                     => Err(e.to_string()),
    }
}

/// Store a secret in the OS keychain (creates or overwrites the entry).
#[tauri::command]
fn set_secret(key: String, value: String) -> Result<(), String> {
    validate_key(&key)?;
    let entry = Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

/// Delete a secret from the OS keychain.
/// Silently succeeds if the entry does not exist.
#[tauri::command]
fn delete_secret(key: String) -> Result<(), String> {
    validate_key(&key)?;
    let entry = Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_)                      => Ok(()),
        Err(KeyringError::NoEntry) => Ok(()),
        Err(e)                     => Err(e.to_string()),
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(LanSyncManager::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_tray::init())
        .setup(|app| {
            // System tray: left-click or "Open" to show, "Quit" to exit
            let show = MenuItem::with_id(app, "show", "Open NERD_JOURNAL_", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("NERD_JOURNAL_")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_secret,
            set_secret,
            delete_secret,
            lan_sync::lan_sync_start,
            lan_sync::lan_sync_status,
            lan_sync::lan_sync_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running NERD_JOURNAL_");
}
