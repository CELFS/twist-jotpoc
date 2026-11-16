use serde::{Deserialize, Serialize};
use tauri::{plugin::{Builder, PluginHandle, TauriPlugin}, Manager, State, Wry};

struct Updater(PluginHandle<Wry>);

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Release {
    url: String,
    version: String,
    version_code: i64,
    sha256: String,
    ready_label: String,
    error_label: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DownloadState {
    platform: String,
    installed_code: i64,
    phase: String,
    received: i64,
    total: i64,
    installed_hash: String,
    target_hash: String,
    target_version: String,
}

#[tauri::command]
async fn status(updater: State<'_, Updater>) -> Result<DownloadState, String> {
    updater.0.run_mobile_plugin_async("status", ()).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn download(updater: State<'_, Updater>, release: Release) -> Result<(), String> {
    updater.0.run_mobile_plugin_async("download", release).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn install(updater: State<'_, Updater>) -> Result<(), String> {
    updater.0.run_mobile_plugin_async("install", ()).await.map_err(|e| e.to_string())
}

pub fn init() -> TauriPlugin<Wry> {
    Builder::new("apk-update")
        .setup(|app, api| {
            app.manage(Updater(api.register_android_plugin("app.twist.jotpoc", "UpdatePlugin")?));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![status, download, install])
        .build()
}
