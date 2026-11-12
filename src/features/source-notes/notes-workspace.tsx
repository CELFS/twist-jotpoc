import { LoadingState } from "@/components/ui/loading-state";
import { SidebarHistory, useSidebarSelection } from "@/features/shell/workspace-sidebar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cloudApi } from "@/data/cloud-api";
import { HistoryGroups } from "@/features/shell/history-groups";
import { subscribeToDataChanges } from "@/data/change-bus";
import { getText } from "@/i18n/get-text";
import { RequestError } from "@/features/shell/request-error";
import { NoteEditor } from "./note-editor";

export function NotesWorkspace({ selectedId, onSelect, active }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  active: boolean;
}) {
  const finishSelection = useSidebarSelection();
  const [notes, setNotes] = useState<Awaited<ReturnType<typeof cloudApi.note.summaries>>["notes"]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listVersion = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async (cursor?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError(null);
    try {
      let page = await cloudApi.note.summaries(cursor, controller.signal);
      if (cursor && page.resourceVersion !== listVersion.current) {
        cursor = undefined;
        page = await cloudApi.note.summaries(undefined, controller.signal);
      }
      if (controller.signal.aborted) return;
      listVersion.current = page.resourceVersion;
      setNotes(previous => cursor ? [...previous, ...page.notes.filter(note => !previous.some(item => item.id === note.id))] : page.notes);
      setCursor(page.nextCursor);
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "unavailable");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    if (active) void load();
    return () => request.current?.abort();
  }, [active, load]);
  useEffect(() => subscribeToDataChanges(change => {
    if (change.entity === "sourceNotes" && active) void load();
  }), [active, load]);

  return <section className="notes-workspace">
    <div className="workspace-toolbar">
      <Button variant="secondary" onClick={() => onSelect(null)}><Plus size={16} />{getText("client.newNote")}</Button>
    </div>
    <SidebarHistory tab="notes">
      <div className="sidebar-history-heading">
        <h2>{getText("client.notes")}</h2>
        <Button variant="ghost" size="icon" aria-label={getText("client.refresh")} disabled={loading} onClick={() => void load()}><RefreshCw size={17} /></Button>
      </div>
      <RequestError code={error} />
      {!notes.length && !loading && !error && <p>{getText("client.noNotes")}</p>}
      {loading && <LoadingState compact rows={notes.length ? 1 : 3} label={getText("client.load")} />}
      <HistoryGroups items={notes} groupKey={note => note.dateKey}>{note =>
        <button className="history-item" key={note.id} type="button" aria-current={selectedId === note.id || undefined}
          onClick={() => { onSelect(note.id); finishSelection?.(); }}>
          <strong>{note.pageTitle || getText("dailyMemo.sourceNote.untitledPage")}</strong>
          <span>{note.url}</span>
          {note.summary.trim() && <span>{note.summary.replace(/\s+/g, " ").trim().slice(0, 96)}</span>}
        </button>}</HistoryGroups>
      {cursor && <Button variant="secondary" disabled={loading} onClick={() => void load(cursor)}>{getText("client.more")}</Button>}
    </SidebarHistory>
    <NoteEditor key={selectedId ?? "new"} id={selectedId} onSaved={id => {
      onSelect(id); void load();
    }} onDeleted={() => { onSelect(null); void load(); }} />
  </section>;
}
