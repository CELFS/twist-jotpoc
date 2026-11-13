fn main() {
    println!("cargo:rerun-if-changed=icons/icon.icns");
    let update = tauri_build::InlinedPlugin::new().commands(&["status", "download", "install"]);
    tauri_build::try_build(tauri_build::Attributes::new().plugin("apk-update", update))
        .expect("Failed to prepare JotPoc");
}
