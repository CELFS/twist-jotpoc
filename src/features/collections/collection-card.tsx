import { InkEntry } from "./ink-entry";
import { ExternalLink, NotebookPen, ChevronDown, ChevronUp } from "lucide-react";
import { ResilientLink as Link } from "@/components/resilient-link";
import { useEffect, useState } from "react";
import { createRepositories } from "@/data/repositories";
import { CollectionEntry } from "./collection-entry";
import type { CollectionChanges } from "./collection-edit-drawer";
import type { CollectionListItem, CollectionSourceGroup } from "./collection-groups";
import { getText } from "@/i18n/get-text";

export type { CollectionListItem } from "./collection-groups";

export function CollectionCard({ group, onManage }: { group: CollectionSourceGroup; onManage: (item: CollectionListItem, changes: CollectionChanges | null) => Promise<void> }) {
  const [expanded, setExpanded] = useState(true);
  const [ready, setReady] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(group.urlKey));
      const preferenceKey = "collections.expanded." + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const record = await createRepositories().settings.get(preferenceKey);
      if (active) { setKey(preferenceKey); setExpanded(record?.value !== false); }
    })().catch(() => undefined).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [group.urlKey]);
  const previewLimit = 2;
  const canCollapse = group.items.length > previewLimit;
  const collapsed = canCollapse && !expanded;

  async function toggle() {
    const next = !expanded; setExpanded(next);
    try { if (key) await createRepositories().settings.set(key, next); } catch { setExpanded(!next); }
  }
  return (
    <article className="collection-card" data-collapsed={collapsed || undefined}>
      <header className="collection-source">
        <a href={group.source.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden="true" size={14} />
          <span>{group.source.pageTitle || group.source.url}</span>
        </a>
        {group.noteId && (
          <Link href={`/source-notes/?note=${encodeURIComponent(group.noteId)}`}>
            <NotebookPen aria-hidden="true" size={14} />
            {getText("collections.webNote")}
          </Link>
        )}
        <span className="collection-source-count">{group.source.sourceCount ?? group.items.length}</span>
        {canCollapse && <button type="button" className="collection-collapse" disabled={!ready} aria-expanded={expanded} aria-label={getText(expanded ? "collections.collapse" : "collections.expand")} title={getText(expanded ? "collections.collapse" : "collections.expand")} onClick={() => void toggle()}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>}
      </header>
      <ul className="collection-entries">
        {(collapsed ? group.items.slice(0, previewLimit) : group.items).map((item) => item.kind === "ink"
          ? <InkEntry key={`ink-${item.id}`} item={item} />
          : <CollectionEntry key={item.id} item={item} onManage={onManage} />)}
      </ul>
    </article>
  );
}
