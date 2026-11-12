import { PinButton } from "./pin-button";
import { Settings2 } from "lucide-react";
import appIcon from "../../../src-tauri/icons/128x128.png";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getText } from "@/i18n/get-text";

export function FloatingEntry({
  autoHide,
  busy,
  pinned,
  onPinChange,
  onExpand,
  onSettings,
  onError,
}: {
  autoHide: boolean;
  busy: boolean;
  pinned: boolean;
  onPinChange: (pinned: boolean) => void;
  onExpand: () => void;
  onSettings: () => void;
  onError: () => void;
}) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const moving = useRef(false);
  const dragging = useRef(false);

  const [edge, setEdge] = useState("");
  const timer = useRef<number | undefined>(undefined);
  const stopTimer = () => window.clearTimeout(timer.current);
  const position = (action: string, x = 0, y = 0) =>
    invoke<string>("position_floating_entry", { action, x, y }).then(result => {
      if (result !== "hidden") setEdge(result);
    }).catch(onError);
  const progress = useRef(0);
  const frame = useRef(0);
  const revision = useRef(0);
  const [amount, setAmount] = useState(0);
  const cancelMotion = () => { ++revision.current; cancelAnimationFrame(frame.current); };
  const animate = (target: number) => {
    cancelMotion();
    const ticket = revision.current;
    const from = progress.current;
    if (from === target) return;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200 * Math.abs(target - from);
    const start = performance.now();
    const step = async (now: number) => {
      if (ticket !== revision.current) return;
      const t = duration ? Math.min(1, Math.max(0, (now - start) / duration)) : 1;
      if (t === 0) { frame.current = requestAnimationFrame(step); return; }
      const value = t === 1 ? target : from + (target - from) * (1 - (1 - t) ** 3);
      progress.current = value;
      try {
        const side = await invoke<string>("position_floating_entry", { action: "dock", x: value, y: 0 });
        if (ticket !== revision.current) return;
        progress.current = side ? value : 0;
        setEdge(side);
        setAmount(progress.current);
        if (side && t < 1) frame.current = requestAnimationFrame(step);
      } catch { if (ticket === revision.current) onError(); }
    };
    frame.current = requestAnimationFrame(step);
  };
  const scheduleHide = () => {
    stopTimer();
    if (autoHide) timer.current = window.setTimeout(() => { if (!origin.current) animate(1); }, 450);
  };
  useEffect(() => {
    void position("reveal");
    scheduleHide();
    return () => { stopTimer(); cancelMotion(); };
  }, [autoHide]);
  return <div
    role="group"
    data-edge={edge}
    style={{ "--dock-progress": amount } as CSSProperties}
    onPointerEnter={() => { stopTimer(); animate(0); }}
    onPointerLeave={scheduleHide}
    onFocus={() => { stopTimer(); animate(0); }}
    className="floating-button"
    aria-label={getText("app.expand")}
    onPointerDown={event => {
      if (event.button !== 0) return;
      stopTimer();
      cancelMotion();
      const target = (event.target as Element).closest("button") ?? event.currentTarget;
      target.setPointerCapture(event.pointerId);
      dragging.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
    }}
    onPointerMove={event => {
      const start = origin.current;
      if (!start || !(event.buttons & 1)) return;
      if (!dragging.current && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return;
      dragging.current = true;
      if (!moving.current) {
        moving.current = true;
        progress.current = 0;
        setAmount(0);
        void position("move", start.x, start.y).finally(() => { moving.current = false; });
      }
    }}
    onPointerUp={() => { origin.current = null; if (dragging.current) scheduleHide(); }}
    onPointerCancel={() => { origin.current = null; }}
    onClickCapture={event => {
      if (dragging.current) {
        event.stopPropagation();
        dragging.current = false;
      }
    }}
  >
    <div className="floating-actions">
      <button type="button" disabled={busy} title={getText("app.expand")} aria-label={getText("app.expand")} onClick={onExpand}>
        <img src={appIcon} alt="" width={24} height={24} draggable={false} />
      </button>
      <button type="button" disabled={busy} title={getText("settings.shortLabel")} aria-label={getText("settings.shortLabel")} onClick={onSettings}>
        <Settings2 size={17} />
      </button>
      <PinButton busy={busy} pinned={pinned} onPinChange={onPinChange} />
    </div>
  </div>;
}
