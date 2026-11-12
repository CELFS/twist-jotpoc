import appIcon from "../../../src-tauri/icons/128x128.png";
import { invoke } from "@tauri-apps/api/core";
import { useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getText } from "@/i18n/get-text";

export function FloatingEntry({
  macos,
  busy,
  onExpand,
  onError,
}: {
  macos: boolean;
  busy: boolean;
  onExpand: () => void;
  onError: () => void;
}) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const moving = useRef(false);
  const dragging = useRef(false);

  return <button
    className="floating-button"
    disabled={busy}
    aria-label={getText("app.expand")}
    title={getText("app.expand")}
    type="button"
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragging.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
    }}
    onPointerMove={event => {
      const start = origin.current;
      if (!start || !(event.buttons & 1)) return;
      if (!dragging.current && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return;
      dragging.current = true;
      if (macos) {
        if (!moving.current) {
          moving.current = true;
          void invoke("move_floating_entry", start).catch(onError).finally(() => { moving.current = false; });
        }
        return;
      }
      origin.current = null;
      void getCurrentWindow().startDragging().catch(onError);
    }}
    onPointerUp={() => { origin.current = null; }}
    onPointerCancel={() => { origin.current = null; }}
    onClick={() => {
      if (!dragging.current) onExpand();
      dragging.current = false;
    }}
  >
    <img src={appIcon} alt="" width={56} height={56} draggable={false} />
  </button>;
}
