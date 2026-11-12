import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cloudApi } from "@/data/cloud-api";
import type { CloudNote } from "@/data/contracts";
import { subscribeToDataChanges } from "@/data/change-bus";
import { getText } from "@/i18n/get-text";
import { RequestError } from "@/features/shell/request-error";
import { NoteEditor } from "./note-editor";

export function NotesWorkspace({ selectedId, onSelect, active }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  active: boolean;
}) {
  const [notes, setNotes] = useState<CloudNote[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async (cursor?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError(null);
    try {
      const page = await cloudApi.note.list(cursor, controller.signal);
      if (controller.signal.aborted) return;
      setNotes(previous => cursor ? [...previous, ...page.notes.filter(note => !previous.some(item => item.record.id === note.record.id))] : page.notes);
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
    <aside className="notes-list custom-scrollbar">
      <div className="workspace-toolbar">
        <Button variant="secondary" onClick={() => onSelect(null)}><Plus size={16} />{getText("client.newNote")}</Button>
        <Button variant="ghost" size="icon" aria-label={getText("client.refresh")} disabled={loading} onClick={() => void load()}><RefreshCw size={17} /></Button>
      </div>
      <RequestError code={error} />
      {!notes.length && !loading && !error && <p>{getText("client.noNotes")}</p>}
      {notes.map(note => <button className="note-list-item" key={note.record.id} type="button"
        aria-pressed={selectedId === note.record.id} onClick={() => onSelect(note.record.id)}>
        <strong>{note.resource.customTitle || note.resource.pageTitle || note.resource.url}</strong>
        <time dateTime={note.record.dateKey}>{note.record.dateKey}</time>
        <span>{note.record.content.slice(0, 120)}</span>
      </button>)}
      {cursor && <Button variant="secondary" disabled={loading} onClick={() => void load(cursor)}>{getText("client.more")}</Button>}
    </aside>
    <NoteEditor key={selectedId ?? "new"} id={selectedId} onSaved={id => {
      onSelect(id); void load();
    }} onDeleted={() => { onSelect(null); void load(); }} />
  </section>;
}
