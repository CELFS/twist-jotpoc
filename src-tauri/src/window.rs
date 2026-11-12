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
    #[cfg(desktop)]
    reveal_position: Option<tauri::PhysicalPosition<i32>>,
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
            #[cfg(not(target_os = "macos"))]
            {
                window.set_decorations(true)?;
                window.set_resizable(true)?;
            }
            if let Some(geometry) = &controller.full {
                window.set_size(geometry.size)?;
                window.set_position(geometry.position)?;
            }
            window.set_min_size(Some(tauri::LogicalSize::new(320.0, 360.0)))?;
        }
        WindowMode::Mini => {
            #[cfg(not(target_os = "macos"))]
            {
                window.set_decorations(true)?;
                window.set_resizable(true)?;
            }
            if let Some(geometry) = &controller.mini {
                window.set_size(geometry.size)?;
                window.set_position(geometry.position)?;
            } else {
                window.set_size(tauri::LogicalSize::new(400.0, 600.0))?;
            }
            window.set_min_size(Some(tauri::LogicalSize::new(320.0, 360.0)))?;
        }
        WindowMode::Collapsed => {
            #[cfg(not(target_os = "macos"))]
            {
                window.set_decorations(false)?;
                window.set_resizable(false)?;
            }
            let size = tauri::LogicalSize::new(ORB, ORB);
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
            for kind in [objc2_app_kit::NSWindowButton::CloseButton, objc2_app_kit::NSWindowButton::MiniaturizeButton, objc2_app_kit::NSWindowButton::ZoomButton] {
                if let Some(button) = native.standardWindowButton(kind) {
                    button.setHidden(mode == WindowMode::Collapsed);
                }
            }
            let Some(view) = native.contentView() else { return };
            view.setWantsLayer(true);
            if let Some(layer) = view.layer() {
                let collapsed = mode == WindowMode::Collapsed;
                layer.setCornerRadius(if collapsed { ORB / 2.0 } else { 0.0 });
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
        controller.reveal_position = None;
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

#[cfg(desktop)]
const ORB: f64 = 56.0;
#[cfg(desktop)]
const HANDLE: f64 = 12.0;
#[cfg(desktop)]
const HANDLE_LENGTH: f64 = 30.0;

#[cfg(desktop)]
fn fix_entry_size(window: &WebviewWindow, width: f64, height: f64) -> tauri::Result<()> {
    let size = tauri::LogicalSize::new(width, height);
    window.set_min_size(None::<tauri::LogicalSize<f64>>)?;
    window.set_max_size(None::<tauri::LogicalSize<f64>>)?;
    window.set_size(size)?;
    window.set_max_size(Some(size))?;
    window.set_min_size(Some(size))
}

#[tauri::command]
pub fn position_floating_entry(window: WebviewWindow, controller: State<'_, WindowController>, action: String, x: f64, y: f64) -> Result<String, String> {
    #[cfg(desktop)]
    {
        let mut state = controller.0.lock().map_err(|_| "Window state unavailable")?;
        if state.state.mode != WindowMode::Collapsed { return Ok(String::new()); }
        let moving = action == "move";
        let cursor = window.cursor_position().map_err(|e| e.to_string())?;
        let monitor = if moving { window.monitor_from_point(cursor.x, cursor.y) } else { window.current_monitor() }
            .map_err(|e| e.to_string())?.or(window.primary_monitor().map_err(|e| e.to_string())?)
            .ok_or("Display unavailable")?;
        let scale = monitor.scale_factor();
        let size = (ORB * scale).round() as i32;
        let area = monitor.work_area();
        let left = area.position.x;
        let top = area.position.y;
        let right = (left + area.size.width as i32 - size).max(left);
        let bottom = (top + area.size.height as i32 - size).max(top);
        let mut point = window.outer_position().map_err(|e| e.to_string())?;
        if let Some(saved) = state.reveal_position {
            point = saved;
        }
        if moving {
            point.x = (cursor.x - x.clamp(0.0, ORB) * scale).round() as i32;
            point.y = (cursor.y - y.clamp(0.0, ORB) * scale).round() as i32;
        }
        point.x = point.x.clamp(left, right);
        point.y = point.y.clamp(top, bottom);
        let mut edge = "";
        let progress = if action == "dock" { x.clamp(0.0, 1.0) } else { 0.0 };
        let mut width = ORB;
        let mut height = ORB;
        if progress > 0.0 {
            let (name, distance) = [("left", point.x-left), ("right", right-point.x),
                ("top", point.y-top), ("bottom", bottom-point.y)].into_iter().min_by_key(|item| item.1).unwrap();
            if distance > (8.0 * scale).round() as i32 { return Ok(String::new()); }
            edge = name;
            state.reveal_position = Some(point);
            let vertical = edge == "left" || edge == "right";
            let depth = ORB + (HANDLE - ORB) * progress;
            let length = ORB + (HANDLE_LENGTH - ORB) * progress;
            (width, height) = if vertical { (depth, length) } else { (length, depth) };
            let dx = ((ORB - width) * scale).round() as i32;
            let dy = ((ORB - height) * scale).round() as i32;
            if vertical {
                point.x = if edge == "left" { left } else { right + dx };
                point.y += dy / 2;
            } else {
                point.x += dx / 2;
                point.y = if edge == "top" { top } else { bottom + dy };
            }
        }
        if progress > 0.0 || state.reveal_position.is_some() {
            fix_entry_size(&window, width, height).map_err(|e| e.to_string())?;
            #[cfg(target_os = "macos")]
            {
                let handle = window.ns_window().map_err(|e| e.to_string())?;
                // Match the native mask to the animation; a fixed orb radius rounds the docked edge twice.
                let native = unsafe { &*handle.cast::<objc2_app_kit::NSWindow>() };
                if let Some(layer) = native.contentView().and_then(|view| view.layer()) {
                    layer.setCornerRadius(ORB * 0.5 * (1.0 - progress));
                }
            }
        }
        if progress == 0.0 { state.reveal_position = None; }
        window.set_position(point).map_err(|e| e.to_string())?;
        Ok(edge.to_owned())
    }
    #[cfg(mobile)]
    { let _ = (window, controller, action, x, y); Ok(String::new()) }
}
