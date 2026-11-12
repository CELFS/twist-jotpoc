import { CircleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./button";

export function InfoHint({ text }: { text: string }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [open]);

  return <div ref={root} className="ui-info-hint"
    onPointerLeave={event => { if (event.pointerType === "mouse") setOpen(false); }}>
    <Button size="icon" variant="ghost" aria-label={text} aria-expanded={open}
      aria-controls={id} onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setOpen(true); }}
      onBlur={() => setOpen(false)}
      onPointerEnter={event => { if (event.pointerType === "mouse") setOpen(true); }}
      onClick={event => {
        if (event.currentTarget.matches(":hover") && window.matchMedia("(hover: hover)").matches) setOpen(true);
        else setOpen(value => !value);
      }}>
      <CircleAlert size={16} aria-hidden="true" />
    </Button>
    <span id={id} className="ui-info-hint-text" role="tooltip" hidden={!open}>{text}</span>
  </div>;
}
