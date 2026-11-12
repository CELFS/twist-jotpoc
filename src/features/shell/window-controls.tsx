import { Maximize2, Minimize2, Minus, Pin, PinOff } from "lucide-react";
import { getText } from "@/i18n/get-text";
import type { WindowMode, WindowState } from "@/platform/window";

export function WindowControls({
  busy,
  state,
  onModeChange,
  onPinChange,
}: {
  busy: boolean;
  state: WindowState;
  onModeChange: (mode: WindowMode) => void;
  onPinChange: (pinned: boolean) => void;
}) {
  if (!state.desktop) return null;

  return (
    <div className="window-controls">
      <button
        aria-label={getText(state.pinned ? "app.unpin" : "app.pin")}
        aria-pressed={state.pinned}
        disabled={busy}
        title={getText(state.pinned ? "app.unpin" : "app.pin")}
        type="button"
        onClick={() => onPinChange(!state.pinned)}
      >
        {state.pinned ? <PinOff size={18} /> : <Pin size={18} />}
      </button>
      <button
        aria-label={getText(state.mode === "full" ? "app.miniWindow" : "app.fullWindow")}
        disabled={busy}
        title={getText(state.mode === "full" ? "app.miniWindow" : "app.fullWindow")}
        type="button"
        onClick={() => onModeChange(state.mode === "full" ? "mini" : "full")}
      >
        {state.mode === "full" ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
      <button
        aria-label={getText("app.collapse")}
        disabled={busy}
        title={getText("app.collapse")}
        type="button"
        onClick={() => onModeChange("collapsed")}
      >
        <Minus size={18} />
      </button>
    </div>
  );
}
