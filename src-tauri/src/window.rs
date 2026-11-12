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
    pinned: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            desktop: cfg!(desktop),
            macos: cfg!(target_os = "macos"),
            mode: WindowMode::Full,
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
    match mode {
        WindowMode::Full => {
            window.set_decorations(true)?;
            window.set_resizable(true)?;
            if let Some(geometry) = &controller.full {
                window.set_size(geometry.size)?;
                window.set_position(geometry.position)?;
            }
            window.set_min_size(Some(tauri::LogicalSize::new(320.0, 480.0)))?;
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
            window.set_size(tauri::LogicalSize::new(64.0, 64.0))?;
            if let Some(geometry) = &controller.collapsed {
                window.set_position(geometry.position)?;
            }
        }
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
