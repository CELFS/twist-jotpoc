import { useEffect, useRef, useSyncExternalStore } from "react";
import { TriangleAlert, X } from "lucide-react";
import { getText } from "@/i18n/get-text";

type Notice = { text: string; sources: Set<symbol>; timer: number };
let notices: Notice[] = [];
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => notices;
function dismiss(text: string) {
  const item = notices.find(notice => notice.text === text);
  if (!item) return;
  clearTimeout(item.timer);
  notices = notices.filter(notice => notice !== item);
  listeners.forEach(listener => listener());
}

export function ErrorNotice({ text }: { text: string | null }) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!text || !marker.current) return;
    const source = Symbol();
    let visible = false;
    const release = () => {
      const item = notices.find(notice => notice.text === text);
      if (item?.sources.delete(source) && !item.sources.size) dismiss(text);
    };
    const sync = () => {
      const next = !marker.current?.closest("[hidden], [inert]");
      if (visible === next) return;
      visible = next;
      if (!visible) { release(); return; }
      const existing = notices.find(notice => notice.text === text);
      if (existing) { existing.sources.add(source); return; }
      notices = [...notices, { text, sources: new Set([source]), timer: window.setTimeout(() => dismiss(text), 5000) }];
      listeners.forEach(listener => listener());
    };
    sync();
    const observer = new MutationObserver(sync);
    for (let node = marker.current.parentElement; node; node = node.parentElement) {
      observer.observe(node, { attributes: true, attributeFilter: ["hidden", "inert"] });
    }
    return () => { observer.disconnect(); release(); };
  }, [text]);
  return <span ref={marker} aria-hidden="true" style={{ display: "none" }} />;
}

export function NotificationCenter() {
  const items = useSyncExternalStore(subscribe, snapshot);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !items.length || !element.showPopover) return;
    element.showPopover();
    const raise = (event: Event) => {
      if (event.target instanceof HTMLDialogElement && event.target.open) {
        element.hidePopover(); element.showPopover();
      }
    };
    document.addEventListener("toggle", raise, true);
    return () => { document.removeEventListener("toggle", raise, true); element.hidePopover(); };
  }, [items.length]);
  return <div className="notification-center" ref={ref} popover="manual" hidden={!items.length}>
    {items.map(({ text }) => <div className="notification-card" key={text} role="alert">
      <TriangleAlert size={16} aria-hidden="true" /><span>{text}</span>
      <button type="button" aria-label={getText("common.close")} onClick={() => dismiss(text)}><X size={16} /></button>
    </div>)}
  </div>;
}
