use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{State, WebviewWindow};

#[derive(Clone, Copy, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WindowMode {
    #[default]
    Full,
    Mini,
    Collapsed,
}

#[derive(Clone, Serialize)]
pub struct WindowState {
    desktop: bool,
    macos: bool,
    mode: WindowMode,
    resume_mode: WindowMode,
    pinned: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            desktop: cfg!(desktop),
            macos: cfg!(target_os = "macos"),
            mode: WindowMode::Full,
            resume_mode: WindowMode::Full,
            pinned: false,
        }
    }
}

#[cfg(desktop)]
struct Geometry {
    size: tauri::PhysicalSize<u32>,
    position: tauri::PhysicalPosition<i32>,
}

#[derive(Default)]
struct Controller {
    state: WindowState,
    #[cfg(desktop)]
    full: Option<Geometry>,
    #[cfg(desktop)]
    mini: Option<Geometry>,
    #[cfg(desktop)]
    collapsed: Option<Geometry>,
}

#[derive(Default)]
pub struct WindowController(Mutex<Controller>);

#[tauri::command]
pub fn read_window_state(controller: State<'_, WindowController>) -> Result<WindowState, String> {
    let controller = controller.0.lock().map_err(|_| "Window state unavailable")?;
    Ok(controller.state.clone())
}

#[cfg(desktop)]
fn apply_mode(window: &WebviewWindow, controller: &Controller, mode: WindowMode) -> tauri::Result<()> {
    // Clear minimum dimensions before shrinking into the floating entry.
    window.set_min_size(None::<tauri::LogicalSize<f64>>)?;
    window.set_max_size(None::<tauri::LogicalSize<f64>>)?;
    match mode {
        WindowMode::Full => {
            window.set_decorations(true)?;
            window.set_resizable(true)?;
            if let Some(geometry) = &controller.full {
                window.set_size(geometry.size)?;
                window.set_position(geometry.position)?;
            }
            window.set_min_size(Some(tauri::LogicalSize::new(320.0, 360.0)))?;
        }
        WindowMode::Mini => {
            window.set_decorations(true)?;
            window.set_resizable(true)?;
            if let Some(geometry) = &controller.mini {
                window.set_size(geometry.size)?;
                window.set_position(geometry.position)?;
            } else {
                window.set_size(tauri::LogicalSize::new(400.0, 600.0))?;
            }
            window.set_min_size(Some(tauri::LogicalSize::new(320.0, 360.0)))?;
        }
        WindowMode::Collapsed => {
            window.set_decorations(false)?;
            window.set_resizable(false)?;
            let size = tauri::LogicalSize::new(64.0, 64.0);
            window.set_size(size)?;
            window.set_max_size(Some(size))?;
            window.set_min_size(Some(size))?;
            if let Some(geometry) = &controller.collapsed {
                window.set_position(geometry.position)?;
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        if mode != WindowMode::Collapsed {
            window.set_title_bar_style(tauri::TitleBarStyle::Overlay)?;
        }
        let native_window = window.clone();
        window.run_on_main_thread(move || {
            use objc2_app_kit::{NSColor, NSWindow};
            let Ok(handle) = native_window.ns_window() else { return };
            // Tauri owns this NSWindow; AppKit operations run on its main thread.
            let native = unsafe { &*handle.cast::<NSWindow>() };
            let Some(view) = native.contentView() else { return };
            view.setWantsLayer(true);
            if let Some(layer) = view.layer() {
                let collapsed = mode == WindowMode::Collapsed;
                layer.setCornerRadius(if collapsed { 32.0 } else { 0.0 });
                layer.setMasksToBounds(collapsed);
                native.setOpaque(!collapsed);
                let background = if collapsed { NSColor::clearColor() } else { NSColor::windowBackgroundColor() };
                native.setBackgroundColor(Some(&background));
                native.invalidateShadow();
            }
        })?;
    }
    window.set_always_on_top(mode == WindowMode::Collapsed || controller.state.pinned)?;
    window.set_focus()?;
    Ok(())
}

#[tauri::command]
pub fn set_window_mode(
    window: WebviewWindow,
    controller: State<'_, WindowController>,
    mode: WindowMode,
) -> Result<WindowState, String> {
    let mut controller = controller.0.lock().map_err(|_| "Window state unavailable")?;
    if mode == controller.state.mode {
        return Ok(controller.state.clone());
    }
    #[cfg(desktop)]
    {
        let previous = controller.state.mode;
        let geometry = Geometry {
            size: window.inner_size().map_err(|error| error.to_string())?,
            position: window.outer_position().map_err(|error| error.to_string())?,
        };
        match previous {
            WindowMode::Full => controller.full = Some(geometry),
            WindowMode::Mini => controller.mini = Some(geometry),
            WindowMode::Collapsed => controller.collapsed = Some(geometry),
        }
        if let Err(error) = apply_mode(&window, &controller, mode) {
            // Restore the prior geometry if a window-manager operation failed.
            apply_mode(&window, &controller, previous).map_err(|restore_error| {
                format!("{error}; window restore failed: {restore_error}")
            })?;
            return Err(error.to_string());
        }
        if mode == WindowMode::Collapsed {
            controller.state.resume_mode = previous;
        }
        controller.state.mode = mode;
        return Ok(controller.state.clone());
    }
    #[cfg(mobile)]
    {
        let _ = (window, mode);
        Err("Desktop window modes require a desktop platform".into())
    }
}

#[tauri::command]
pub fn set_window_pinned(
    window: WebviewWindow,
    controller: State<'_, WindowController>,
    pinned: bool,
) -> Result<WindowState, String> {
    let mut controller = controller.0.lock().map_err(|_| "Window state unavailable")?;
    #[cfg(desktop)]
    {
        window.set_always_on_top(pinned || controller.state.mode == WindowMode::Collapsed)
            .map_err(|error| error.to_string())?;
        controller.state.pinned = pinned;
        return Ok(controller.state.clone());
    }
    #[cfg(mobile)]
    {
        let _ = (window, pinned);
        Err("Desktop pinning requires a desktop platform".into())
    }
}

#[tauri::command]
pub fn move_floating_entry(window: WebviewWindow, controller: State<'_, WindowController>, x: f64, y: f64) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let state = controller.0.lock().map_err(|_| "Window state unavailable")?;
        if state.state.mode != WindowMode::Collapsed || !(0.0..=64.0).contains(&x) || !(0.0..=64.0).contains(&y) {
            return Ok(());
        }
        // Synchronous Tauri commands run on the main thread. Moving the frame directly
        // keeps AppKit's interactive edge-tiling gesture out of floating-entry drags.
        let handle = window.ns_window().map_err(|e| e.to_string())?;
        let native = unsafe { &*handle.cast::<objc2_app_kit::NSWindow>() };
        let mouse = native.mouseLocationOutsideOfEventStream();
        let frame = native.frame();
        let mut origin = frame.origin;
        origin.x += mouse.x - x;
        origin.y += mouse.y - (frame.size.height - y);
        native.setFrameOrigin(origin);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (window, controller, x, y);
    Ok(())
}
