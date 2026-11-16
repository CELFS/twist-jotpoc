import { MarkSources } from "./mark-sources";
import { SidebarHistory, useSidebarSelection } from "@/features/shell/workspace-sidebar";
import { authenticatedFetch } from "@/platform/http";

import type { MarkItem } from "./collection-groups";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { translationCursorSchema } from "@/translation/contracts";
import { collectionItemSchema } from "@/extension/collection-contracts";
import { getText } from "@/i18n/get-text";
import { CollectionCard, type CollectionListItem } from "./collection-card";
import { groupCollectionsBySource } from "./collection-groups";
import { CollectionStatus } from "./collection-status";
import { z } from "zod";

const cursorSchema = translationCursorSchema.extend({ id: z.string().regex(/^[ei][A-Za-z0-9_-]{21}$/) });
const excerptSchema = collectionItemSchema.safeExtend({
  urlKey: z.string(), noteId: z.string().nullable(), sourceCount: z.number(),
});
const inkSchema = z.object({
  id: z.string(), kind: z.literal("ink"), text: z.string(), url: z.httpUrl(), urlKey: z.string(),
  pageTitle: z.string(), noteId: z.string().nullable(), sourceCount: z.number(),
  color: z.enum(["red", "purple", "blue", "green", "yellow"]),
  lineStyle: z.enum(["highlight", "underline", "wavy"]),
});
const responseSchema = z.object({ items: z.array(z.union([inkSchema, excerptSchema])), nextCursor: cursorSchema.nullable() });

export function CollectionsPage({ active = true }: { active?: boolean }) {
  const [items, setItems] = useState<MarkItem[]>([]);
  const [nextCursor, setNextCursor] = useState<z.infer<typeof cursorSchema> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "signedOut">("loading");
  const [filter, setFilter] = useState<"all" | "ink" | "excerpt">("all");
  const [source, setSource] = useState<string | null>(null);
  const [directoryRevision, setDirectoryRevision] = useState(0);
  const finishSelection = useSidebarSelection();
  const loaded = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const load = useCallback(async (cursor: z.infer<typeof cursorSchema> | null = null) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("loading");
    if (cursor === null) setNextCursor(null);
    try {
      const response = await authenticatedFetch(`/api/extension/collections?view=marks&filter=${filter}&source=${encodeURIComponent(source ?? "")}&cursor=${encodeURIComponent(JSON.stringify(cursor))}`, {
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (response.status === 401) { setItems([]); setStatus("signedOut"); return; }
      if (!response.ok) throw new Error("collection_load_failed");
      const result = responseSchema.parse(await response.json());
      if (controller.signal.aborted) return;
      setItems((previous) => cursor === null ? result.items : [
        ...previous, ...result.items.filter((item) => !previous.some((existing) => existing.id === item.id && (existing.kind === "ink") === (item.kind === "ink"))),
      ]);
      setNextCursor(result.nextCursor);
      setStatus("ready"); loaded.current = true;
    } catch {
      if (!controller.signal.aborted) setStatus("error");
    }
  }, [filter, source]);

  useEffect(() => {
    loaded.current = false;
    setItems([]);
    setNextCursor(null);
    setStatus("loading");
  }, [load]);

  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => {
      if (!live) return;
      if (active && !loaded.current) void load();
      else setStatus(current => current === "loading" ? "ready" : current);
    });
    return () => { live = false; requestRef.current?.abort(); };
  }, [active, load]);

  async function manage(item: CollectionListItem, changes: { text: string; note: string; kind: CollectionListItem["kind"] } | null) {
    const response = await authenticatedFetch("/api/extension/collections/manage", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: changes ? "update" : "delete", id: item.id, expectedUpdatedAt: item.updatedAt, ...changes }),
    });
    if (!response.ok) throw new Error(response.status === 409 ? "conflict" : "save");
    const result = await response.json();
    requestRef.current?.abort();
    setStatus("ready");
    if (changes) {
      setItems((current) => current.map((entry) => entry.kind !== "ink" && entry.id === item.id ? { ...entry, ...result.item } : entry));
    } else {
      setDirectoryRevision(value => value + 1);
      // Deleting a row leaves the cursor for the remaining pages stable.
      setItems((current) => current.filter((entry) => entry.kind === "ink" || entry.id !== item.id).map((entry) => entry.urlKey === item.urlKey
        ? { ...entry, sourceCount: Math.max(0, (entry.sourceCount ?? current.filter((candidate) => candidate.urlKey === item.urlKey).length) - 1) } : entry));
    }
  }

  const library = (
    <div className="collections-page">
      {source && <Button variant="ghost" onClick={() => setSource(null)}>{getText("collections.backAll")}</Button>}
      <header className="collections-heading">
        <div className="mark-filters" role="group" aria-label={getText("collections.title")}>
          {(["all", "ink", "excerpt"] as const).map(value => <Button key={value} variant="ghost"
            aria-pressed={value === filter} onClick={() => setFilter(value)}>{getText(`collections.${value}`)}</Button>)}
        </div>
        <Button variant="ghost" size="icon" aria-label={getText("collections.refresh")} title={getText("collections.refresh")} disabled={status === "loading"} onClick={() => { setDirectoryRevision(value => value + 1); void load(); }}>
          <RefreshCw aria-hidden="true" size={16} />
        </Button>
      </header>
      <CollectionStatus status={status} empty={items.length === 0} onRetry={() => void load(items.length > 0 ? nextCursor : null)} />
      <section className="collections-list" aria-label={getText("collections.title")}>
        {groupCollectionsBySource(items).map((group) => <CollectionCard key={group.urlKey} group={group} onManage={manage} />)}
      </section>
      {nextCursor !== null && status !== "error" && (
        <Button variant="secondary" disabled={status === "loading"} onClick={() => void load(nextCursor)}>
          {getText("collections.more")}
        </Button>
      )}
    </div>
  );
  return <>{library}<SidebarHistory tab="collections"><MarkSources selected={source} revision={directoryRevision}
    onSelect={key => { setSource(key); finishSelection?.(); }} /></SidebarHistory></>;
}
