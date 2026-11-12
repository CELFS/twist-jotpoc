import { LoadingState } from "@/components/ui/loading-state";
import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { DateSelection } from "@/components/date-selection";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditorActions, useFormattingPreference } from "@/features/daily-memos/editor-actions";
import { DailyMemoRichTextEditor, type DailyMemoRichTextEditorHandle, type DailyMemoEditorHistoryState } from "@/features/daily-memos/daily-memo-rich-text-editor";
import { RequestError } from "@/features/shell/request-error";
import { getDatabase, type NoteDraft } from "@/data/database";
import { cloudApi } from "@/data/cloud-api";
import { publishDataChange } from "@/data/change-bus";
import type { CloudNote, NoteSaveInput } from "@/data/contracts";
import type { MemoSourcePreset } from "@/data/models";
import { getText } from "@/i18n/get-text";
import { todayKey } from "@/lib/date";
import { ApiError } from "@/platform/http";

const noop = () => undefined;

function newDraft(): NoteDraft {
  return { key: "new", url: "", pageTitle: "", dateKey: todayKey(), noteId: nanoid(),
    sourcePresetId: null, content: "", expectedNoteVersion: 0, expectedResourceVersion: 0, updatedAt: Date.now() };
}

export function NoteEditor({ id, onSaved, onDeleted }: {
  id: string | null;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const database = useRef(getDatabase()).current;
  const [draft, setDraft] = useState<NoteDraft>(newDraft);
  const current = useRef(draft);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(!id);
  const [reload, setReload] = useState(0);
  const [sources, setSources] = useState<MemoSourcePreset[]>([]);
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ note: CloudNote | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editor = useRef<DailyMemoRichTextEditorHandle>(null);
  const [history, setHistory] = useState<DailyMemoEditorHistoryState>({ canUndo: false, canRedo: false });
  const preference = useFormattingPreference();
  const composing = useRef(false);

  const assign = (value: NoteDraft) => { current.current = value; setDraft(value); };
  const persist = (value: NoteDraft) => {
    const operation = writes.current.catch(() => undefined).then(() => database.noteDrafts.put(value));
    writes.current = operation;
    return operation;
  };

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      setError(null);
      setReady(false);
      try {
        const local = await database.noteDrafts.get(id ?? "new");
        if (!active) return;
        if (local) {
          assign(local);
          setDirty(true);
          setLoaded(true);
        }
        void cloudApi.sources().then(result => {
          if (active) setSources(result.sources);
        }).catch(() => { /* A failed source refresh must not hide an existing note or local draft. */ });
        const remote = id ? await cloudApi.note.detail(id, controller.signal) : null;
        if (!active) return;
        if (id && !remote) {
          if (local) setConflict({ note: null });
          else { setLoaded(false); setError("unavailable"); }
          return;
        }
        if (local) {
          if (remote && remote.version !== local.expectedNoteVersion) setConflict({ note: remote });
        } else if (remote) {
          const context = await cloudApi.note.context(remote.resource.url, remote.record.dateKey, controller.signal);
          if (!active) return;
          assign({
            key: id!, noteId: remote.record.id, url: remote.resource.url,
            pageTitle: remote.resource.pageTitle, dateKey: remote.record.dateKey,
            sourcePresetId: remote.record.sourcePresetId, content: remote.record.content,
            expectedNoteVersion: remote.version, expectedResourceVersion: context.resource?.version ?? 0,
            updatedAt: Date.now(),
          });
          setDirty(false);
          setLoaded(true);
        } else { assign(newDraft()); setLoaded(true); }
      } catch (error) {
        if (active && !controller.signal.aborted) setError(error instanceof Error ? error.message : "unavailable");
      } finally {
        if (active) setReady(true);
      }
    };
    void load();
    return () => { active = false; controller.abort(); };
  }, [database, id, reload]);

  const update = (patch: Partial<NoteDraft>) => {
    if (writing.current) return;
    const next = { ...current.current, ...patch, updatedAt: Date.now() };
    assign(next);
    setDirty(true);
    setError(null);
    void persist(next).catch(() => setError("storage_failed"));
  };

  const validateUrl = (value: string) => {
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
      return url.href;
    } catch { throw new ApiError("invalid_url"); }
  };

  const save = async (value = current.current, resolvedConflict = false) => {
    if (writing.current || composing.current || !value.content.trim() || (conflict && !resolvedConflict)) return;
    writing.current = true; setBusy(true); setError(null);
    try {
      const url = validateUrl(value.url);
      const context = await cloudApi.note.context(url, value.dateKey);
      let payload: NoteSaveInput = value.pending ?? {
        operationId: nanoid(32), noteId: value.noteId, url, pageTitle: value.pageTitle,
        dateKey: value.dateKey, sourcePresetId: value.sourcePresetId, content: value.content,
        expectedNoteVersion: value.expectedNoteVersion,
        expectedResourceVersion: context.resource?.version ?? 0,
      };
      // Persist the exact operation before upload so retries retain its idempotency identity.
      let pendingDraft = { ...value, pending: payload };
      assign(pendingDraft);
      await persist(pendingDraft);
      let result = await cloudApi.note.save(payload);
      let note = result.notes.find(item => item.record.id === payload.noteId);
      if (!note || note.record.content !== payload.content || note.record.sourcePresetId !== payload.sourcePresetId) {
        setConflict({ note: await cloudApi.note.detail(payload.noteId) });
        throw new ApiError("conflict");
      }
      if (payload.content !== value.content || payload.sourcePresetId !== value.sourcePresetId || payload.pageTitle !== value.pageTitle) {
        payload = { ...payload, operationId: nanoid(32), content: value.content,
          sourcePresetId: value.sourcePresetId, pageTitle: value.pageTitle, expectedNoteVersion: note.version,
          expectedResourceVersion: result.resource?.version ?? 0 };
        pendingDraft = { ...value, pending: payload };
        assign(pendingDraft);
        await persist(pendingDraft);
        result = await cloudApi.note.save(payload);
        note = result.notes.find(item => item.record.id === payload.noteId);
        if (!note || note.record.content !== payload.content) throw new ApiError("conflict");
      }
      await writes.current;
      await database.noteDrafts.delete(value.key);
      assign({ ...value, key: payload.noteId, pending: undefined,
        expectedNoteVersion: note.version, expectedResourceVersion: result.resource?.version ?? 0 });
      setDirty(false);
      publishDataChange({ entity: "sourceNotes", id: payload.noteId });
      onSaved(payload.noteId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "unavailable");
      if (error instanceof ApiError && error.code === "conflict" && current.current.expectedNoteVersion > 0) {
        try { setConflict({ note: await cloudApi.note.detail(current.current.noteId) }); }
        catch { /* Preserve the local draft while the conflicting version is unavailable. */ }
      }
    } finally {
      writing.current = false; setBusy(false);
    }
  };

  const keepLocal = async () => {
    if (!conflict) return;
    try {
      const value = current.current;
      const context = await cloudApi.note.context(validateUrl(value.url), value.dateKey);
      const next = { ...value, noteId: conflict.note?.record.id ?? nanoid(), pending: undefined,
        expectedNoteVersion: conflict.note?.version ?? 0,
        expectedResourceVersion: context.resource?.version ?? 0 };
      assign(next);
      await persist(next);
      setConflict(null); setError(null);
      await save(next, true);
    } catch (error) { setError(error instanceof Error ? error.message : "unavailable"); }
  };

  const useCloud = async () => {
    if (!conflict) return;
    try {
      const remote = conflict.note;
      if (!remote) {
        await writes.current.catch(() => undefined);
        await database.noteDrafts.delete(current.current.key);
        onDeleted();
        return;
      }
      const context = await cloudApi.note.context(remote.resource.url, remote.record.dateKey);
      await writes.current.catch(() => undefined);
      await database.noteDrafts.delete(current.current.key);
      assign({ key: remote.record.id, noteId: remote.record.id, url: remote.resource.url,
        pageTitle: remote.resource.pageTitle, dateKey: remote.record.dateKey, content: remote.record.content,
        sourcePresetId: remote.record.sourcePresetId, expectedNoteVersion: remote.version,
        expectedResourceVersion: context.resource?.version ?? 0, updatedAt: Date.now() });
      setDirty(false); setConflict(null); setError(null);
    } catch { setError("storage_failed"); }
  };

  const remove = async () => {
    if (writing.current || !id) return;
    writing.current = true; setBusy(true); setError(null);
    try {
      const value = current.current;
      await cloudApi.note.remove({ operationId: nanoid(32), noteId: value.noteId,
        url: value.url, dateKey: value.dateKey, expectedNoteVersion: value.expectedNoteVersion });
      await writes.current.catch(() => undefined);
      await database.noteDrafts.delete(value.key);
      publishDataChange({ entity: "sourceNotes", id });
      onDeleted();
    } catch (error) {
      setError(error instanceof Error ? error.message : "unavailable");
    } finally { writing.current = false; setBusy(false); }
  };

  if (!ready) return <LoadingState label={getText("client.load")} />;
  if (!loaded) return <section className="note-editor">
    <RequestError code={error} />
    <Button variant="secondary" onClick={() => setReload(value => value + 1)}>{getText("client.refresh")}</Button>
  </section>;
  return <section className="note-editor">
    <RequestError code={error ?? (preference.failed ? "storage_failed" : null)} />
    <label className="ui-field"><span>{getText("client.url")}</span>
      <input className="ui-input" type="url" value={draft.url} readOnly={Boolean(id) || busy || Boolean(draft.pending)}
        onChange={event => update({ url: event.target.value })} />
    </label>
    <label className="ui-field"><span>{getText("client.pageTitle")}</span>
      <input className="ui-input" value={draft.pageTitle} maxLength={500} disabled={busy}
        onChange={event => update({ pageTitle: event.target.value })} />
    </label>
    <DateSelection value={draft.dateKey} disabled={Boolean(id) || busy || Boolean(draft.pending)} onChange={dateKey => update({ dateKey })} />
    <SelectField label={getText("client.source")} disabled={busy} value={draft.sourcePresetId ?? ""}
      onChange={event => update({ sourcePresetId: event.target.value || null })}>
      <option value="">{getText("client.noSource")}</option>
      {sources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
    </SelectField>
    <div className="workspace-toolbar">
      <EditorActions readOnly={busy} history={history} preference={preference}
        onUndo={() => editor.current?.undo()} onRedo={() => editor.current?.redo()} />
    </div>
    <DailyMemoRichTextEditor ref={editor} content={draft.content} label={getText("client.noteContent")} preview={busy}
      memoInfoEnabled={false} sourcePresets={sources} toolbarExpanded={!busy && preference.value} placeholder={getText("client.notePlaceholder")}
      onChange={content => update({ content })} onCompositionChange={value => { composing.current = value; }}
      onHistoryStateChange={setHistory} onCursorNearFloatingControlsChange={noop}
      onScrollActivity={noop} onScrollGestureStart={noop} onScrollGestureEnd={noop}
    />
    <div className="client-actions">
      <Button disabled={busy || !dirty || !draft.content.trim() || Boolean(conflict)} onClick={() => void save()}>
        {getText(busy ? "client.saving" : "client.save")}
      </Button>
      {id && <Button variant="ghost" disabled={busy} onClick={() => setConfirmDelete(true)}>{getText("client.delete")}</Button>}
    </div>
    {conflict && <section className="client-conflict" role="alert">
      <strong>{getText("client.conflictTitle")}</strong>
      <label className="ui-field"><span>{getText("client.cloudVersion")}</span>
        <textarea className="ui-input custom-scrollbar" readOnly value={conflict.note?.record.content ?? getText("client.emptyCloud")} />
      </label>
      <div className="client-actions">
        <Button onClick={() => void keepLocal()}>{getText("client.keepLocal")}</Button>
        <Button variant="secondary" onClick={() => void useCloud()}>{getText("client.useCloud")}</Button>
      </div>
    </section>}
    <ConfirmDialog open={confirmDelete} busy={busy} title={getText("client.confirmDelete")}
      description={getText("client.deleteDescription")} closeLabel={getText("client.cancel")}
      cancelLabel={getText("client.cancel")} confirmLabel={getText("client.delete")}
      onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()} />
  </section>;
}
