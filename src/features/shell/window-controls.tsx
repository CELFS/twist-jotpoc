import { Expand, PanelBottomClose, PictureInPicture2 } from "lucide-react";
import { PinButton } from "./pin-button";
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
      <PinButton busy={busy} pinned={state.pinned} onPinChange={onPinChange} />
      <button
        aria-label={getText(state.mode === "full" ? "app.miniWindow" : "app.fullWindow")}
        disabled={busy}
        title={getText(state.mode === "full" ? "app.miniWindow" : "app.fullWindow")}
        type="button"
        onClick={() => onModeChange(state.mode === "full" ? "mini" : "full")}
      >
        {state.mode === "full" ? <PictureInPicture2 size={18} /> : <Expand size={18} />}
      </button>
      <button
        aria-label={getText("app.collapse")}
        disabled={busy}
        title={getText("app.collapse")}
        type="button"
        onClick={() => onModeChange("collapsed")}
      >
        <PanelBottomClose size={18} />
      </button>
    </div>
  );
}
