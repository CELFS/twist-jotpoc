mod window;

#[tauri::command]
fn log_auth_failure(stage: String, code: String, status: u16) {
    eprintln!("[JotPoc auth] stage={stage} status={status} code={code}");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(target_os = "macos")]
    let builder = builder.on_window_event(|window, event| {
        if matches!(event, tauri::WindowEvent::Focused(_) | tauri::WindowEvent::Resized(_)) {
            let Ok(handle) = window.ns_window() else { return };
            // Native window events are delivered on the AppKit main thread.
            let native = unsafe { &*handle.cast::<objc2_app_kit::NSWindow>() };
            window::update_inactive_controls(native);
        }
    });
    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_secure_keystore::init())
        .manage(window::WindowController::default())
        .invoke_handler(tauri::generate_handler![
            log_auth_failure,
            window::position_floating_entry,
            window::read_window_state,
            window::set_window_mode,
            window::set_window_pinned,
        ])
        .run(tauri::generate_context!())
        .expect("Unable to run JotPoc");
}
