import { authenticatedFetch } from "@/platform/http";

import { Star, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { translationCursorSchema } from "@/translation/contracts";
import { collectionItemSchema } from "@/extension/collection-contracts";
import { getText } from "@/i18n/get-text";
import { CollectionCard, type CollectionListItem } from "./collection-card";
import { groupCollectionsBySource } from "./collection-groups";
import { CollectionStatus } from "./collection-status";
import { z } from "zod";

const responseSchema = z.object({
  items: z.array(collectionItemSchema.safeExtend({ urlKey: z.string(), noteId: z.string().nullable(), sourceCount: z.number().optional() })),
  nextCursor: translationCursorSchema.nullable(),
});

export function CollectionsPage({ embedded = false, active = true }: { embedded?: boolean; active?: boolean }) {
  const [items, setItems] = useState<CollectionListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<z.infer<typeof translationCursorSchema> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "signedOut">("loading");
  const loaded = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const load = useCallback(async (cursor: z.infer<typeof translationCursorSchema> | null = null) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("loading");
    if (cursor === null) setNextCursor(null);
    try {
      const response = await authenticatedFetch(`/api/extension/collections?cursor=${encodeURIComponent(JSON.stringify(cursor))}`, {
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (response.status === 401) { setItems([]); setStatus("signedOut"); return; }
      if (!response.ok) throw new Error("collection_load_failed");
      const result = responseSchema.parse(await response.json());
      if (controller.signal.aborted) return;
      setItems((previous) => cursor === null ? result.items : [
        ...previous, ...result.items.filter((item) => !previous.some((existing) => existing.id === item.id)),
      ]);
      setNextCursor(result.nextCursor);
      setStatus("ready"); loaded.current = true;
    } catch {
      if (!controller.signal.aborted) setStatus("error");
    }
  }, []);

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
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...result.item } : entry));
    } else {
      // Deleting a row leaves the cursor for the remaining pages stable.
      setItems((current) => current.filter((entry) => entry.id !== item.id).map((entry) => entry.urlKey === item.urlKey
        ? { ...entry, sourceCount: Math.max(0, (entry.sourceCount ?? current.filter((candidate) => candidate.urlKey === item.urlKey).length) - 1) } : entry));
    }
  }

  return (
    <div className="collections-page">
      <header className="collections-heading">
        <div className="experiments-heading">
          {embedded ? <h2>{getText("translation.webCollections")}</h2> : <h1>{getText("collections.title")}</h1>}
        </div>
        <Button variant="ghost" size="icon" aria-label={getText("collections.refresh")} title={getText("collections.refresh")} disabled={status === "loading"} onClick={() => void load()}>
          <RefreshCw aria-hidden="true" size={16} />
        </Button>
      </header>
      {!embedded && <div className="collections-domain"><Star aria-hidden="true" size={16} />{getText("collections.en")}</div>}
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
}
