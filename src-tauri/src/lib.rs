mod window;

#[tauri::command]
fn log_auth_failure(stage: String, code: String, status: u16) {
    eprintln!("[JotPoc auth] stage={stage} status={status} code={code}");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_secure_keystore::init())
        .manage(window::WindowController::default())
        .invoke_handler(tauri::generate_handler![
            log_auth_failure,
            window::move_floating_entry,
            window::read_window_state,
            window::set_window_mode,
            window::set_window_pinned,
        ])
        .run(tauri::generate_context!())
        .expect("Unable to run JotPoc");
}
