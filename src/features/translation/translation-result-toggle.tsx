
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createRepositories } from "@/data/repositories";
import { subscribeToDataChanges } from "@/data/change-bus";
import { getText } from "@/i18n/get-text";

const preferenceKey = "translation.resultExpanded";

export function TranslationResultToggle({ children, status, model, actions, headerActions, settings, onExpandedChange, title, defaultExpanded = true, persistExpanded = true, className = "" }: {
  children: ReactNode;
  status?: ReactNode;
  model?: ReactNode;
  actions?: ReactNode;
  headerActions?: ReactNode;
  settings?: ReactNode;
  onExpandedChange?: (expanded: boolean) => void;
  title?: string;
  defaultExpanded?: boolean;
  persistExpanded?: boolean;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [ready, setReady] = useState(!persistExpanded);
  const bodyId = useId();
  const onChange = useRef(onExpandedChange);
  const writes = useRef(Promise.resolve());
  useEffect(() => { onChange.current = onExpandedChange; }, [onExpandedChange]);
  useEffect(() => {
    if (!persistExpanded) return;
    let active = true;
    let revision = 0;
    const load = () => {
      const current = ++revision;
      void createRepositories().settings.get(preferenceKey).then(value => {
        if (active && revision === current) { setExpanded(value?.value !== false); onChange.current?.(value?.value !== false); }
      }).catch(() => undefined).finally(() => { if (active) setReady(true); });
    };
    load();
    const unsubscribe = subscribeToDataChanges(change => {
      if (change.entity === "settings" && change.id === preferenceKey) load();
    });
    return () => { active = false; unsubscribe(); };
  }, [persistExpanded]);
  function toggle() {
    const next = !expanded;
    setExpanded(next);
    onExpandedChange?.(next);
    if (persistExpanded) writes.current = writes.current.then(() => createRepositories().settings.set(preferenceKey, next)).then(() => undefined).catch(() => undefined);
  }
  return <section className={`translation-result ${className}`} aria-label={title ?? getText("translation.result")} data-expanded={ready && expanded}>
    {headerActions || actions ? <div className="translation-result-heading" data-result-actions={!!actions || undefined}>
      <strong>{title ?? getText("translation.result")}</strong>{status}{actions && <div className="translation-actions">{actions}</div>}{model && <span className="translation-model">{model}</span>}
      {headerActions}
      <button className="translation-result-collapse" type="button" aria-label={title ?? getText("translation.result")} aria-expanded={ready && expanded} aria-controls={bodyId} disabled={!ready} onClick={toggle}>
        {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>
    </div> : <>
    <button className="translation-result-toggle" type="button" aria-expanded={ready && expanded} aria-controls={bodyId} disabled={!ready} onClick={toggle}>
      <strong>{title ?? getText("translation.result")}</strong>{status}<span className="translation-model">{model}</span>
      {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
    </button>
    </>}
    {settings}
    <div className="translation-result-body" id={bodyId} hidden={!ready || !expanded}>{children}</div>
  </section>;
}
