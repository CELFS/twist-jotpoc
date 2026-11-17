mod window;
mod network_log;
#[cfg(target_os = "macos")]
mod macos_update;
#[cfg(target_os = "android")]
mod android_update;

#[tauri::command]
fn log_auth_failure(stage: String, code: String, status: u16) {
    eprintln!("[JotPoc auth] stage={stage} status={status} code={code}");
}

#[derive(serde::Serialize)]
struct AuthorizationDeviceInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    os: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
}

#[tauri::command]
fn authorization_device_info() -> AuthorizationDeviceInfo {
    let os = match std::env::consts::OS {
        "windows" => Some("Windows"),
        "macos" => Some("macOS"),
        "linux" => Some("Linux"),
        "android" => Some("Android"),
        "ios" => Some("iOS"),
        _ => None,
    };
    let name = match std::env::consts::OS {
        "windows" => std::env::var("COMPUTERNAME").ok(),
        "linux" => std::fs::read_to_string("/etc/hostname").ok(),
        "macos" => system_label("/usr/sbin/scutil", &["--get", "ComputerName"]),
        "android" => system_label("/system/bin/getprop", &["ro.product.model"]),
        _ => None,
    };
    AuthorizationDeviceInfo {
        os,
        name: name.map(|s| s.trim().chars().take(60).collect::<String>())
            .filter(|s| !s.is_empty()),
    }
}

fn system_label(program: &str, args: &[&str]) -> Option<String> {
    let output = std::process::Command::new(program).args(args).output().ok()?;
    if !output.status.success() { return None; }
    String::from_utf8(output.stdout).ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(target_os = "macos")]
    let builder = builder.on_window_event(|window, event| {
        if window.label() == "main" {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Err(error) = window.hide() {
                    eprintln!("[JotPoc window] hide failed: {error}");
                }
            }
        }
        if matches!(event, tauri::WindowEvent::Focused(_) | tauri::WindowEvent::Resized(_)) {
            let Ok(handle) = window.ns_window() else { return };
            // Native window events are delivered on the AppKit main thread.
            let native = unsafe { &*handle.cast::<objc2_app_kit::NSWindow>() };
            window::update_inactive_controls(native);
        }
    });
    #[cfg(target_os = "android")]
    let builder = builder.plugin(android_update::init());
    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_secure_keystore::init())
        .manage(window::WindowController::default())
        .invoke_handler(tauri::generate_handler![
            #[cfg(target_os = "macos")]
            macos_update::install_macos_update,
            log_auth_failure,
            network_log::log_network_failure,
            authorization_device_info,
            window::position_floating_entry,
            window::read_window_state,
            window::set_window_mode,
            window::set_window_pinned,
        ])
        .build(tauri::generate_context!())
        .expect("Unable to build JotPoc")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                if let Err(error) = window::reopen_main_window(_app) {
                    eprintln!("[JotPoc window] reopen failed: {error}");
                }
            }
        });
}
