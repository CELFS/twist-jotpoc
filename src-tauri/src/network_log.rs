use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

static LOG_LOCK: Mutex<()> = Mutex::new(());

#[tauri::command]
pub async fn log_network_failure(app: tauri::AppHandle, record: String) -> Result<(), String> {
    let dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    let _guard = LOG_LOCK.lock().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("network.log");
    if fs::metadata(&path).is_ok_and(|file| file.len() >= 1024 * 1024) {
        let previous = dir.join("network.previous.log");
        if previous.exists() {
            fs::remove_file(&previous).map_err(|e| e.to_string())?;
        }
        fs::rename(&path, previous).map_err(|e| e.to_string())?;
    }
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?;
    let record: String = record.chars().filter(|c| !c.is_control()).take(2048).collect();
    let mut file = OpenOptions::new().create(true).append(true).open(path).map_err(|e| e.to_string())?;
    writeln!(file, "{} {record}", now.as_millis()).map_err(|e| e.to_string())
}
