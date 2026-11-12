
import { Check, ChevronDown, ChevronsUp, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export function TagMultiSelect<T extends string>({ label, removeLabel, expandLabel, collapseLabel, options, value, onChange, disabled = false, minSelected = 0 }: {
  label: string; expandLabel: string; collapseLabel: string; removeLabel: (label: string) => string;
  options: readonly { value: T; label: string }[]; value: readonly T[];
  onChange: (value: T[]) => void; disabled?: boolean; minSelected?: number;
}) {
  const id = useId();
  const field = useRef<HTMLDivElement>(null);
  const valuesRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(1);
  const selectedOptions = options.filter(option => value.includes(option.value));
  const selectedKey = JSON.stringify(selectedOptions);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({});
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const visible = open && !disabled;
  if (disabled && open) setOpen(false);
  useLayoutEffect(() => {
    const values = valuesRef.current;
    const measure = measureRef.current;
    if (!values || !measure) return;
    const fit = () => {
      let width = 0;
      let count = 0;
      for (const tag of Array.from(measure.children)) {
        width += tag.getBoundingClientRect().width + (count ? 5 : 0);
        if (width > values.clientWidth) break;
        count++;
      }
      setVisibleCount(Math.max(1, count));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(values);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [selectedKey]);
  useLayoutEffect(() => {
    if (!visible || !field.current) return;
    const dialog = field.current.closest("dialog");
    setPortal(dialog ?? document.body);
    const place = () => {
      if (!field.current) return;
      const rect = field.current.getBoundingClientRect();
      const bounds = dialog?.getBoundingClientRect();
      const bottom = Math.min(window.innerHeight, bounds?.bottom ?? window.innerHeight) - 8;
      const top = Math.max(8, bounds?.top ?? 8);
      const below = bottom - rect.bottom - 6;
      const above = rect.top - top - 6;
      const upwards = below < Math.min(240, above);
      const left = Math.max(8, (bounds?.left ?? 0) + 8);
      const right = Math.min(window.innerWidth, bounds?.right ?? window.innerWidth) - 8;
      const width = Math.min(rect.width, Math.max(0, right - left));
      setPosition({ left: Math.max(left, Math.min(rect.left, right - width)), width,
        top: upwards ? rect.top - 6 : rect.bottom + 6, transform: upwards ? "translateY(-100%)" : undefined,
        maxHeight: Math.max(0, Math.min(280, upwards ? above : below)) });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(field.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const outside = (event: Event) => {
      if (!field.current?.contains(event.target as Node) && !list.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); };
  }, [visible]);
  useEffect(() => { if (visible) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active, visible]);
  function select(option: T) {
    if (disabled) return;
    const selected = value.includes(option);
    if (selected && value.length <= minSelected) return;
    onChange(options.filter(item => item.value === option ? !selected : value.includes(item.value)).map(item => item.value));
  }
  return <div ref={field} className="ui-tag-select" role="group" aria-label={label} data-disabled={disabled || undefined} onClick={event => { if (!disabled && !(event.target as HTMLElement).closest("button")) { trigger.current?.focus(); setOpen(!visible); } }}>
    <div ref={valuesRef} id={`${id}-values`} className="ui-tag-select-values" data-expanded={expanded}>
      {(expanded ? selectedOptions : selectedOptions.slice(0, visibleCount)).map(option => <span className="ui-tag-select-tag" key={option.value}>
        <span>{option.label}</span><button type="button" disabled={disabled || value.length <= minSelected} aria-label={removeLabel(option.label)} onClick={() => { trigger.current?.focus(); select(option.value); }}><X size={12} aria-hidden="true" /></button>
      </span>)}
    </div>
    <div ref={measureRef} className="ui-tag-select-measure" aria-hidden="true">
      {selectedOptions.map(option => <span className="ui-tag-select-tag" key={option.value}><span>{option.label}</span><i><X size={12} /></i></span>)}
    </div>
    {selectedOptions.length > 1 && <button type="button" className="ui-tag-select-more" aria-label={expanded ? collapseLabel : expandLabel} title={expanded ? collapseLabel : expandLabel} aria-expanded={expanded} aria-controls={`${id}-values`} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronsUp size={14} aria-hidden="true" /> : selectedOptions.length > visibleCount ? `+${selectedOptions.length - visibleCount}` : <ChevronDown size={14} aria-hidden="true" />}</button>}
    <button ref={trigger} type="button" className="ui-tag-select-toggle" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={visible} aria-controls={visible ? id : undefined} aria-activedescendant={visible ? `${id}-${active}` : undefined} disabled={disabled}
      onClick={() => setOpen(!visible)} onKeyDown={event => {
        if (event.key === "Escape" && visible) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault(); setOpen(true);
          setActive(index => event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : !visible ? (event.key === "ArrowUp" ? options.length - 1 : 0) : (index + (event.key === "ArrowUp" ? -1 : 1) + options.length) % options.length);
        } else if ((event.key === "Enter" || event.key === " ") && visible) { event.preventDefault(); if (options[active]) select(options[active].value); }
        else if (event.key === "Tab") setOpen(false);
      }}><ChevronDown size={16} aria-hidden="true" /></button>
    {visible && portal && createPortal(<div ref={list} id={id} role="listbox" aria-label={label} aria-multiselectable="true" className="ui-select-listbox ui-tag-select-listbox custom-scrollbar" style={position}>
      {options.map((option, index) => <button key={option.value} id={`${id}-${index}`} data-index={index} type="button" role="option" tabIndex={-1} className="ui-select-option" aria-selected={value.includes(option.value)} aria-disabled={value.includes(option.value) && value.length <= minSelected} data-active={index === active} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => { trigger.current?.focus(); select(option.value); }}>
        <span>{option.label}</span>{value.includes(option.value) && <Check size={16} className="ui-select-option-check" aria-hidden="true" />}
      </button>)}
    </div>, portal)}
  </div>;
}
