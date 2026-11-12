import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getText } from "@/i18n/get-text";
import { LoadingState } from "@/components/ui/loading-state";
import { authenticatedFetch } from "@/platform/http";
type Source = { urlKey: string; pageTitle: string; count: number };

export function MarkSources({ selected, revision, onSelect }: {
  selected: string | null; revision: number; onSelect: (source: string | null) => void;
}) {
  const [rows, setRows] = useState<Source[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async (after: string | null) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setFailed(false);
    try {
      const query = new URLSearchParams({ view: "sources", after: after ?? "" });
      const response = await authenticatedFetch("/api/extension/collections?" + query.toString(), { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("load");
      const page = await response.json();
      if (controller.signal.aborted) return;
      if (!Array.isArray(page.items) || !page.items.every((row: Source) =>
        typeof row.urlKey === "string" && typeof row.pageTitle === "string" && Number.isInteger(row.count))
        || (page.nextCursor !== null && typeof page.nextCursor !== "string")) throw new Error("invalidResponse");
      setRows(previous => after ? [...previous, ...page.items] : page.items);
      setCursor(page.nextCursor);
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    setRows([]);
    setCursor(null);
    void load(null);
    return () => request.current?.abort();
  }, [load, revision]);
  const titles = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    if (titles.has(row.pageTitle)) duplicates.add(row.pageTitle);
    titles.add(row.pageTitle);
  }
  return <nav className="mark-sources custom-scrollbar" aria-label={getText("collections.sources")}>
    <button type="button" className="history-item" aria-current={selected === null} onClick={() => onSelect(null)}>
      <strong>{getText("collections.allSources")}</strong>
    </button>
    {rows.map(row => <button type="button" className="history-item" key={row.urlKey} title={row.urlKey}
      aria-current={selected === row.urlKey} onClick={() => onSelect(row.urlKey)}>
      <strong>{row.pageTitle || row.urlKey}</strong><span>{row.count}</span>
      {duplicates.has(row.pageTitle) && <small>{new URL(row.urlKey).host}</small>}
    </button>)}
    {loading && <LoadingState label={getText("collections.loading")} compact rows={2} />}
    {failed && <Button variant="secondary" onClick={() => void load(cursor)}>{getText("collections.retry")}</Button>}
    {cursor && !loading && !failed && <Button variant="ghost" onClick={() => void load(cursor)}>{getText("collections.more")}</Button>}
  </nav>;
}
