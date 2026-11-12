import { LoadingState } from "@/components/ui/loading-state";
import { HistoryGroups, historyDate } from "@/features/shell/history-groups";
import { SidebarHistory, useSidebarSelection } from "@/features/shell/workspace-sidebar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Undo2, Redo2, Type, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateSelection } from "@/components/date-selection";
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
  const finishSelection = useSidebarSelection();
  const [dateKey, setDateKey] = useState(todayKey);
  const controller = useMemo(() => memoController(accountId, dateKey), [accountId, dateKey]);
  const state = useMemoController(controller);
  const [sources, setSources] = useState<MemoSourcePreset[]>([]);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof cloudApi.memo.history>>["memos"]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const historyRevision = useRef(0);
  const toolbarPreference = useTranslationPreference("dailyMemo.syntaxToolbarExpanded", false);
  const toolbar = toolbarPreference.value;
  const { preview, setPreview } = useDailyMemoPreviewPreference();
  const [historyState, setHistoryState] = useState<DailyMemoEditorHistoryState>({ canRedo: false, canUndo: false });
  const [error, setError] = useState<string | null>(null);
  const editor = useRef<DailyMemoRichTextEditorHandle>(null);

  const refresh = useCallback(async () => {
    const revision = ++historyRevision.current;
    setHistoryLoading(true); setError(null);
    try {
      const [sourceResult, memoHistory] = await Promise.all([cloudApi.sources(), cloudApi.memo.history()]);
      if (revision !== historyRevision.current) return;
      setSources(sourceResult.sources);
      setHistory(memoHistory.memos);
    } catch (error) {
      if (revision === historyRevision.current) setError(error instanceof Error ? error.message : "unavailable");
    } finally { if (revision === historyRevision.current) setHistoryLoading(false); }
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
    <SidebarHistory tab="memos">
      <h2>{getText("client.history")}</h2>
      <RequestError code={error} />
      {historyLoading && <LoadingState compact rows={history.length ? 1 : 3} label={getText("client.load")} />}
      {error && <Button variant="ghost" onClick={() => void refresh()}>{getText("client.refresh")}</Button>}
      {!historyLoading && history.length === 0 && !error && <p>{getText("client.noMemoHistory")}</p>}
      <HistoryGroups items={history} groupKey={item => item.dateKey.slice(0, 7)}>{item => <button type="button" className="history-item" key={item.dateKey}
        aria-current={item.dateKey === dateKey || undefined}
        onClick={() => { setDateKey(item.dateKey); finishSelection?.(); }}>
        <strong>{item.title || getText("dailyMemo.defaultTitle")}</strong>
        <time dateTime={item.dateKey}>{historyDate(item.dateKey)}</time>
        {item.preview && <span>{item.preview}</span>}
      </button>}</HistoryGroups>
    </SidebarHistory>
    <RequestError code={state.error ?? error ?? (toolbarPreference.failed ? "storage_failed" : null)} />
    {!state.ready ? <LoadingState label={getText("client.load")} /> : <>
      {state.permissionKnown && !state.editable && <p className="client-notice">{getText("client.readOnly")}</p>}
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
