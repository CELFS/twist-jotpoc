import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { getText } from "@/i18n/get-text";

type Props = {
  mode: "mini" | "full";
  open: boolean;
};

const minimum = 128;
const clamp = (value: number, max: number) => Math.max(minimum, Math.min(value, max));

export function SidebarResizer({ mode, open }: Props) {
  const separator = useRef<HTMLDivElement>(null);
  const key = `jotpoc.sidebar.width.${mode}`;
  const [preferred, setPreferred] = useState<number | null>(() => {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value >= minimum ? value : null;
  });
  const [viewport, setViewport] = useState(window.innerWidth);
  const [live, setLive] = useState<number | null>(null);
  const drag = useRef<{ id: number; start: number; width: number } | null>(null);
  // Wider headers keep the desktop controls to the left of the page tabs.
  const maximum = Math.max(minimum, viewport - (viewport <= 430 ? 176 : 280));
  const width = clamp(live ?? preferred ?? Math.min(240, viewport * 0.32), maximum);

  useLayoutEffect(() => {
    const element = separator.current?.closest<HTMLDivElement>(".expanded-shell");
    if (!element) return;
    const resize = () => setViewport(element.clientWidth);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const element = separator.current?.closest<HTMLDivElement>(".expanded-shell");
    if (!element) return;
    element.style.setProperty("--sidebar-width", `${width}px`);
    element.toggleAttribute("data-resizing", live !== null);
    return () => {
      element.style.removeProperty("--sidebar-width");
      element.removeAttribute("data-resizing");
    };
  }, [width, live]);

  function save(next: number) {
    setPreferred(next);
    localStorage.setItem(key, String(next));
  }
  function cancel() {
    drag.current = null;
    setLive(null);
  }
  function position(event: PointerEvent<HTMLDivElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return null;
    return clamp(Math.round(gesture.width + gesture.start - event.clientX), maximum);
  }
  return <div ref={separator} className="sidebar-resizer" role="separator" tabIndex={open ? 0 : -1}
    aria-label={getText("client.sidebar")} aria-controls="workspace-sidebar" aria-orientation="vertical"
    aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={Math.round(width)}
    onPointerDown={event => {
      if (!open || event.button !== 0 || !event.isPrimary || drag.current) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { id: event.pointerId, start: event.clientX, width };
      setLive(width);
    }}
    onPointerMove={event => { const next = position(event); if (next !== null) setLive(next); }}
    onPointerUp={event => {
      const next = position(event);
      if (next === null) return;
      if (event.clientX !== drag.current?.start) save(next);
      cancel();
    }}
    onLostPointerCapture={cancel} onPointerCancel={cancel}
    onKeyDown={event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      save(clamp(Math.round(width) + (event.key === "ArrowLeft" ? 8 : -8), maximum));
    }} />;
}
