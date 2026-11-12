import { invoke } from "@tauri-apps/api/core";

export type WindowMode = "full" | "mini" | "collapsed";

export type WindowState = {
  desktop: boolean;
  macos: boolean;
  windows: boolean;
  mode: WindowMode;
  resume_mode: WindowMode;
  pinned: boolean;
};

export function readWindowState(): Promise<WindowState> {
  return invoke<WindowState>("read_window_state");
}

export function setWindowMode(mode: WindowMode): Promise<WindowState> {
  return invoke<WindowState>("set_window_mode", { mode });
}

export function setWindowPinned(pinned: boolean): Promise<WindowState> {
  return invoke<WindowState>("set_window_pinned", { pinned });
}
