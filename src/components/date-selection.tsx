import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format, parseISO, startOfMonth } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getIntlLocale } from "@/i18n/app-language";
import { getText } from "@/i18n/get-text";
import { todayKey } from "@/lib/date";

export function DateSelection({ value, onChange, disabled = false, datesWithData }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  datesWithData?: ReadonlySet<string>;
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseISO(value)));
  const triggerRoot = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 280, maxHeight: 400 });
  const focusTrigger = () => triggerRoot.current?.querySelector("button")?.focus();

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRoot.current?.getBoundingClientRect();
      if (!trigger) return;
      const width = Math.min(280, window.innerWidth - 24);
      const height = Math.min(panel.current?.scrollHeight ?? 320, window.innerHeight - 24);
      const below = trigger.bottom + 8;
      const top = below + height <= window.innerHeight - 12 ? below
        : Math.max(12, trigger.top - height - 8);
      setPosition({ left: Math.max(12, Math.min(trigger.left, window.innerWidth - width - 12)),
        top, width, maxHeight: window.innerHeight - top - 12 });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!triggerRoot.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); focusTrigger(); }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const days = useMemo(() => {
    const start = new Date(visibleMonth);
    start.setDate(1 - start.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [visibleMonth]);
  const locale = getIntlLocale();
  const monthLabel = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(visibleMonth);
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2026, 7, 2 + index)));

  return <div ref={triggerRoot} className="client-date-selection">
    <Button variant="ghost" disabled={disabled} aria-label={getText("client.date")}
      aria-expanded={open} aria-haspopup="dialog"
      onClick={() => { setVisibleMonth(startOfMonth(parseISO(value))); setOpen(!open); }}>
      <CalendarDays size={16} /><time dateTime={value}>{value}</time>
      {datesWithData?.has(value) && <span aria-hidden="true" className="client-date-activity client-date-trigger-activity" />}
    </Button>
    {open && createPortal(<div ref={panel} role="dialog" aria-label={getText("client.date")}
      className="client-date-popover custom-scrollbar" style={position}>
      <div className="client-date-popover-header">
        <Button variant="ghost" size="icon" aria-label={getText("datePicker.previousMonth")}
          onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
          <ChevronLeft size={18} />
        </Button>
        <strong>{monthLabel}</strong>
        <Button variant="ghost" size="icon" aria-label={getText("datePicker.nextMonth")}
          onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
          <ChevronRight size={18} />
        </Button>
      </div>
      <div className="client-calendar-grid client-calendar-weekdays" aria-hidden="true">
        {weekdays.map((weekday, index) => <span key={index}>{weekday}</span>)}
      </div>
      <div className="client-calendar-grid">
        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          return <button key={key} type="button" className="client-calendar-day" aria-label={key}
            aria-current={key === todayKey() ? "date" : undefined}
            aria-pressed={key === value} data-selected={key === value || undefined}
            data-outside={day.getMonth() !== visibleMonth.getMonth() || undefined}
            onClick={() => { onChange(key); setOpen(false); focusTrigger(); }}>
            <span>{day.getDate()}</span>
            {datesWithData?.has(key) && <span aria-hidden="true" className="client-date-activity" />}
          </button>;
        })}
      </div>
    </div>, document.body)}
  </div>;
}
