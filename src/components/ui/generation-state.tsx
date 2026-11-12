
import { useEffect, useRef } from "react";
import { LoadingState } from "./loading-state";

export function GenerationState({ label, text, lang, working = true }: { label: string; text?: string; lang?: string; working?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  useEffect(() => {
    if (following.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [text]);

  return <div className="ui-generation-state" aria-busy={working}>
    <p className="ui-generation-status" role="status">{label}</p>
    <div className="ui-generation-stream custom-scrollbar" ref={viewport} onScroll={event => {
      const node = event.currentTarget;
      following.current = node.scrollHeight - node.scrollTop - node.clientHeight < 32;
    }}>
      {text ? <p lang={lang}>{text}</p> : working ? <LoadingState label={label} rows={2} /> : null}
    </div>
  </div>;
}
