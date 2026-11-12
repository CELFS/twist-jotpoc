import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Undo2, Redo2, Type, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateSelection } from "@/components/date-selection";
import { SelectField } from "@/components/ui/select-field";
import { cloudApi } from "@/data/cloud-api";
import type { MemoSourcePreset } from "@/data/models";
import { subscribeToDataChanges } from "@/data/change-bus";
import { getText } from "@/i18n/get-text";
import { todayKey } from "@/lib/date";
import { useTranslationPreference } from "@/features/translation/use-translation-preference";
import { useDailyMemoPreviewPreference } from "./use-daily-memo-preview-preference";
import { RequestError } from "@/features/shell/request-error";
import { memoController, useMemoController } from "./memo-controller";
import { DailyMemoRichTextEditor, type DailyMemoRichTextEditorHandle, type DailyMemoEditorHistoryState } from "./daily-memo-rich-text-editor";

const noop = () => undefined;

export function MemoWorkspace({ accountId }: { accountId: string }) {
  const [dateKey, setDateKey] = useState(todayKey);
  const controller = useMemo(() => memoController(accountId, dateKey), [accountId, dateKey]);
  const state = useMemoController(controller);
  const [sources, setSources] = useState<MemoSourcePreset[]>([]);
  const [history, setHistory] = useState<Array<{ dateKey: string; title: string }>>([]);
  const toolbarPreference = useTranslationPreference("dailyMemo.syntaxToolbarExpanded", false);
  const toolbar = toolbarPreference.value;
  const { preview, setPreview } = useDailyMemoPreviewPreference();
  const [historyState, setHistoryState] = useState<DailyMemoEditorHistoryState>({ canRedo: false, canUndo: false });
  const [error, setError] = useState<string | null>(null);
  const editor = useRef<DailyMemoRichTextEditorHandle>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [sourceResult, memoHistory] = await Promise.all([cloudApi.sources(), cloudApi.memo.history()]);
      setSources(sourceResult.sources);
      setHistory(memoHistory.memos);
    } catch (error) {
      setError(error instanceof Error ? error.message : "unavailable");
    }
  }, []);

  useEffect(() => { void controller.load(); }, [controller]);
  useEffect(() => {
    void refresh();
    return subscribeToDataChanges(change => {
      if (change.entity === "dailyMemos") { void refresh(); void controller.refresh(); }
    });
  }, [controller, refresh]);

  const switchDay = (offset: number) => {
    const next = new Date(`${dateKey}T12:00:00`);
    next.setDate(next.getDate() + offset);
    setDateKey(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`);
  };

  return <section className="memo-workspace">
    <div className="workspace-toolbar">
      <Button variant="ghost" size="icon" aria-label={getText("client.previousDay")} onClick={() => switchDay(-1)}><ChevronLeft size={18} /></Button>
      <DateSelection value={dateKey} onChange={setDateKey} />
      <Button variant="ghost" size="icon" aria-label={getText("client.nextDay")} onClick={() => switchDay(1)}><ChevronRight size={18} /></Button>
      <Button variant="ghost" onClick={() => setDateKey(todayKey())}>{getText("client.today")}</Button>
      <Button variant="ghost" size="icon" aria-label={getText("client.refresh")} onClick={() => { void refresh(); void controller.refresh(); }}><RefreshCw size={17} /></Button>
    </div>
    <SelectField label={getText("client.history")} value={dateKey} onChange={event => setDateKey(event.target.value)}>
      {!history.some(item => item.dateKey === dateKey) && <option value={dateKey}>{dateKey}</option>}
      {history.map(item => <option key={item.dateKey} value={item.dateKey}>{item.dateKey}{item.title ? ` · ${item.title}` : ""}</option>)}
    </SelectField>
    <RequestError code={state.error ?? error ?? (toolbarPreference.failed ? "storage_failed" : null)} />
    {!state.ready ? <p role="status">{getText("client.load")}</p> : <>
      {!state.editable && <p className="client-notice">{getText("client.readOnly")}</p>}
      <label className="ui-field">
        <span className="ui-field-label">{getText("client.title")}</span>
        <input className="ui-input" value={state.title} maxLength={120} readOnly={!state.editable}
          onCompositionStart={() => controller.setComposing(true)} onCompositionEnd={() => controller.setComposing(false)}
          onChange={event => controller.update({ title: event.target.value })} />
      </label>
      <div className="workspace-toolbar">
        <Button variant="ghost" size="icon" aria-label={getText("client.undo")} disabled={!historyState.canUndo || !state.editable} onClick={() => editor.current?.undo()}><Undo2 size={17} /></Button>
        <Button variant="ghost" size="icon" aria-label={getText("client.redo")} disabled={!historyState.canRedo || !state.editable} onClick={() => editor.current?.redo()}><Redo2 size={17} /></Button>
        <Button variant="ghost" size="icon" aria-label={getText("client.toolbar")} aria-pressed={toolbar} disabled={!toolbarPreference.ready || toolbarPreference.saving} onClick={() => void toolbarPreference.toggle()}><Type size={17} /></Button>
        <Button variant="ghost" size="icon" aria-label={getText("client.preview")} aria-pressed={preview} onClick={() => setPreview(!preview)}><BookOpen size={17} /></Button>
        <span className="save-status" role="status">{getText(state.saving ? "client.saving" : state.dirty ? "client.unsaved" : "client.saved")}</span>
        <Button disabled={!state.editable || !state.dirty || state.saving || Boolean(state.conflict)} onClick={() => void controller.save()}>{getText("client.save")}</Button>
      </div>
      <DailyMemoRichTextEditor
        key={dateKey} ref={editor} content={state.content} label={getText("client.memoContent")}
        preview={preview || !state.editable} placeholder={getText("client.memoPlaceholder")}
        sourcePresets={sources} toolbarExpanded={toolbar} onChange={content => controller.update({ content })}
        onCompositionChange={controller.setComposing} onHistoryStateChange={setHistoryState}
        onCursorNearFloatingControlsChange={noop} onScrollActivity={noop} onScrollGestureEnd={noop} onScrollGestureStart={noop}
      />
      {state.conflict && <section className="client-conflict" role="alert">
        <strong>{getText("client.conflictTitle")}</strong>
        <label className="ui-field"><span>{getText("client.cloudVersion")}</span>
          <input className="ui-input" readOnly value={state.conflict.memo?.record.title ?? ""} />
          <textarea className="ui-input custom-scrollbar" readOnly value={state.conflict.memo?.record.content ?? getText("client.emptyCloud")} />
        </label>
        <div className="client-actions">
          <Button onClick={() => void controller.keepLocal().catch(() => setError("storage_failed"))}>{getText("client.keepLocal")}</Button>
          <Button variant="secondary" onClick={() => void controller.useCloud().catch(() => setError("storage_failed"))}>{getText("client.useCloud")}</Button>
        </div>
      </section>}
    </>}
  </section>;
}
