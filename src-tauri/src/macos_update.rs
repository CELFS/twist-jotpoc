use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    ffi::{CString, OsString},
    fs::{self, File},
    io::{self, Write},
    os::unix::ffi::{OsStrExt, OsStringExt},
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use tauri_plugin_http::reqwest;

const ORIGIN: &str = "https://twist-balance.pages.dev";
static INSTALLING: AtomicBool = AtomicBool::new(false);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Release {
    url: String,
    sha256: String,
    installed_sha256: String,
    version: String,
}

struct UpdateDirectory(PathBuf);

impl UpdateDirectory {
    fn create(parent: &Path) -> io::Result<Self> {
        let result = Command::new("/usr/bin/mktemp").arg("-d")
            .arg(parent.join(".jotpoc-update.XXXXXXXX")).output()?;
        if !result.status.success() { return Err(io::Error::other(String::from_utf8_lossy(&result.stderr))); }
        let mut bytes = result.stdout;
        if bytes.last() == Some(&b'\n') { bytes.pop(); }
        Ok(Self(PathBuf::from(OsString::from_vec(bytes))))
    }
}

impl Drop for UpdateDirectory {
    fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); }
}

fn swap_bundles(current: &Path, replacement: &Path) -> io::Result<()> {
    unsafe extern "C" {
        fn renamex_np(from: *const std::ffi::c_char, to: *const std::ffi::c_char, flags: u32) -> i32;
    }
    let from = CString::new(current.as_os_str().as_bytes())?;
    let to = CString::new(replacement.as_os_str().as_bytes())?;
    // RENAME_SWAP atomically exchanges both bundles on the same volume.
    if unsafe { renamex_np(from.as_ptr(), to.as_ptr(), 2) } == 0 { Ok(()) } else { Err(io::Error::last_os_error()) }
}

fn stage_and_relaunch(dmg: &Path, version: &str) -> Result<(), Box<dyn std::error::Error>> {
    let executable = std::env::current_exe()?;
    let bundle = executable.ancestors().nth(3).ok_or("Missing application bundle")?;
    if bundle.extension().and_then(|ext| ext.to_str()) != Some("app") ||
        !executable.starts_with(bundle.join("Contents/MacOS")) { return Err("Run the installed app".into()); }
    let lock = File::open(bundle)?;
    lock.try_lock()?;
    let stage = UpdateDirectory::create(bundle.parent().ok_or("Missing parent")?)?;
    let replacement = stage.0.join("JotPoc.app");
    let copied = Command::new("/bin/bash").arg("-c").arg(include_str!("stage-macos-update.sh"))
        .arg("stage-macos-update").arg(dmg).arg(&replacement).arg(version).output()?;
    if !copied.status.success() { return Err(String::from_utf8_lossy(&copied.stderr).into_owned().into()); }
    swap_bundles(bundle, &replacement)?;
    let launched = Command::new("/usr/bin/open").arg("-n").arg(bundle).status();
    if !launched.is_ok_and(|status| status.success()) {
        // Keep the original bundle available even if the filesystem rejects rollback.
        if let Err(error) = swap_bundles(bundle, &replacement) { std::mem::forget(stage); return Err(error.into()); }
        return Err("Relaunch failed".into());
    }
    Ok(())
}

async fn update(expected_hash: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let build = option_env!("VITE_JOTPOC_BUILD_ID").ok_or("Missing release build ID")?;
    let client = reqwest::Client::builder().connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(300)).redirect(reqwest::redirect::Policy::none()).build()?;
    let response = client.get(format!("{ORIGIN}/api/extension/jotpoc-release"))
        .query(&[("platform", "macos"), ("build", build)]).send().await?.error_for_status()?;
    let release: Release = serde_json::from_slice(&response.bytes().await?)?;
    if release.sha256.len() != 64 || !release.sha256.bytes().all(|b| b.is_ascii_hexdigit()) ||
        release.sha256 != expected_hash || release.sha256 == release.installed_sha256 {
        return Err("Release changed; check again".into());
    }
    let filename = release.url.strip_prefix("/downloads/jotpoc/").ok_or("Invalid release URL")?;
    if !filename.ends_with(".dmg") || !filename.bytes().all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b)) {
        return Err("Invalid package filename".into());
    }
    let directory = UpdateDirectory::create(&std::env::temp_dir())?;
    let dmg = directory.0.join("update.dmg");
    let mut package = client.get(format!("{ORIGIN}{}", release.url)).send().await?.error_for_status()?;
    let mut file = File::create(&dmg)?;
    let mut digest = Sha256::new();
    while let Some(chunk) = package.chunk().await? { file.write_all(&chunk)?; digest.update(&chunk); }
    drop(file);
    if format!("{:x}", digest.finalize()) != release.sha256 { return Err("Package hash mismatch".into()); }
    tauri::async_runtime::spawn_blocking(move || stage_and_relaunch(&dmg, &release.version).map_err(|e| e.to_string())).await??;
    Ok(())
}

#[tauri::command]
pub async fn install_macos_update(app: tauri::AppHandle, expected_hash: String) -> Result<(), String> {
    if INSTALLING.swap(true, Ordering::AcqRel) { return Err("Update already running".into()); }
    match update(&expected_hash).await {
        Ok(()) => { app.exit(0); Ok(()) }
        Err(error) => {
            INSTALLING.store(false, Ordering::Release);
            let reason = error.to_string();
            let record = serde_json::json!({ "stage": "macos-update", "reason": reason });
            let _ = crate::network_log::log_network_failure(app, record.to_string()).await;
            Err(reason)
        }
    }
}
