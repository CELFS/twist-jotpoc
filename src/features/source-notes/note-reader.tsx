import { useEffect, useState } from "react";
import { ExternalLink, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { cloudApi } from "@/data/cloud-api";
import type { CloudNote } from "@/data/contracts";
import type { MemoSourcePreset } from "@/data/models";
import { DailyMemoRichTextEditor } from "@/features/daily-memos/daily-memo-rich-text-editor";
import { historyDate } from "@/features/shell/history-groups";
import { RequestError } from "@/features/shell/request-error";
import { getText } from "@/i18n/get-text";

const noop = () => undefined;
const presets: MemoSourcePreset[] = [];

export function NoteReader({ id, onEdit }: { id: string; onEdit: () => void }) {
  const [note, setNote] = useState<CloudNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void cloudApi.note.detail(id, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (result) setNote(result);
      else setError("unavailable");
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "unavailable");
    });
    return () => controller.abort();
  }, [id, revision]);

  if (!note && !error) return <LoadingState label={getText("client.load")} />;
  return <article className="note-reader">
    <RequestError code={error} />
    <div className="workspace-toolbar">
      <Button variant="secondary" onClick={onEdit}><Pencil size={16} />{getText("common.edit")}</Button>
      {error && <Button variant="ghost" onClick={() => setRevision(value => value + 1)}>{getText("client.refresh")}</Button>}
    </div>
    {note && <>
      <h2>{note.resource.customTitle || note.resource.pageTitle || getText("dailyMemo.sourceNote.untitledPage")}</h2>
      <time dateTime={note.record.dateKey}>{historyDate(note.record.dateKey)}</time>
      {/^https?:\/\//i.test(note.resource.url) && <a href={note.resource.url} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={14} aria-hidden="true" /> {note.resource.url}
      </a>}
      <DailyMemoRichTextEditor preview memoInfoEnabled={false} content={note.record.content}
        label={getText("client.noteContent")} placeholder="" sourcePresets={presets} toolbarExpanded={false}
        onChange={noop} onCompositionChange={noop} onHistoryStateChange={noop} onScrollActivity={noop}
        onScrollGestureStart={noop} onScrollGestureEnd={noop} onCursorNearFloatingControlsChange={noop} />
    </>}
  </article>;
}
