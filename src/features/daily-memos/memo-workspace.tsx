import { LoadingState } from "@/components/ui/loading-state";
import { HistoryGroups, historyDate } from "@/features/shell/history-groups";
import { SidebarHistory, useSidebarSelection } from "@/features/shell/workspace-sidebar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, BookOpen, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateSelection } from "@/components/date-selection";
import { cloudApi } from "@/data/cloud-api";
import type { MemoSourcePreset } from "@/data/models";
import { subscribeToDataChanges } from "@/data/change-bus";
import { getText } from "@/i18n/get-text";
import { todayKey } from "@/lib/date";
import { FormatToggle, HistoryActions, useFormattingPreference } from "./editor-actions";
import { DailyMemoPreviewStatus } from "./daily-memo-preview-status";
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
  const [sources, setSources] = useState<MemoSourcePreset[] | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof cloudApi.memo.history>>["memos"]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const historyRevision = useRef(0);
  const toolbarPreference = useFormattingPreference();
  const { preview, setPreview } = useDailyMemoPreviewPreference();
  const readOnly = preview || !state.editable;
  const [historyState, setHistoryState] = useState<DailyMemoEditorHistoryState>({ canRedo: false, canUndo: false });
  const [error, setError] = useState<string | null>(null);
  const editor = useRef<DailyMemoRichTextEditorHandle>(null);

  const refresh = useCallback(() => {
    const revision = ++historyRevision.current;
    setHistoryLoading(true);
    setError(null);
    void cloudApi.sources().then(result => {
      if (revision !== historyRevision.current) return;
      setSources(result.sources);
      setSourceError(null);
    }).catch(error => {
      if (revision === historyRevision.current) setSourceError(error instanceof Error ? error.message : "unavailable");
    });
    void cloudApi.memo.history().then(result => {
      if (revision === historyRevision.current) setHistory(result.memos);
    }).catch(error => {
      if (revision === historyRevision.current) setError(error instanceof Error ? error.message : "unavailable");
    }).finally(() => {
      if (revision === historyRevision.current) setHistoryLoading(false);
    });
  }, []);

  useEffect(() => { void controller.load(); }, [controller]);
  useEffect(() => {
    void refresh();
    return subscribeToDataChanges(change => {
      if (change.entity === "dailyMemos") { void refresh(); void controller.refresh(); }
    });
  }, [controller, refresh]);

  useEffect(() => {
    const flush = () => { void controller.save("auto"); };
    const visibilityChanged = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("popstate", flush);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      window.removeEventListener("popstate", flush);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [controller]);

  const saveStatus = state.saveResult === "failed" ? "error" : state.saveIndicatorVisible ? "saving"
    : state.dirty ? "unsaved" : state.saveResult ? "saved" : "idle";

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
      {state.ready && <div className="memo-header-controls">
        <Button variant="ghost" size="icon" className="daily-memo-preview-toggle"
          aria-label={getText(preview ? "dailyMemo.exitPreview" : "dailyMemo.enterPreview")}
          title={getText(preview ? "dailyMemo.exitPreview" : "dailyMemo.enterPreview")}
          aria-pressed={preview} data-active={preview || undefined} disabled={!state.editable}
          onPointerDown={event => event.preventDefault()} onClick={() => setPreview(!preview)}>
          <BookOpen aria-hidden="true" size={19} />
        </Button>
        {preview && <DailyMemoPreviewStatus />}
        <div className="daily-memo-header-status" data-status={saveStatus} aria-live="polite">
          {saveStatus === "error" ? <span role="alert">{getText("dailyMemo.saveFailed")}</span>
            : saveStatus === "saving" ? <span className="daily-memo-save-loading-icon" role="status" aria-label={getText("dailyMemo.saving")} />
            : saveStatus === "unsaved" ? getText("dailyMemo.unsaved")
            : saveStatus === "saved" ? getText(state.saveResult === "auto" ? "dailyMemo.autoSaved" : "dailyMemo.saved")
            : null}
        </div>
        <Button variant="ghost" size="icon" aria-label={getText("dailyMemo.save")} title={getText("dailyMemo.save")}
          disabled={readOnly || !state.dirty || state.saving || Boolean(state.conflict)} onClick={() => void controller.save()}>
          <Save size={17} aria-hidden="true" />
        </Button>
        <HistoryActions readOnly={readOnly} history={historyState}
          onUndo={() => editor.current?.undo()} onRedo={() => editor.current?.redo()} />
      </div>}
    </div>
    <SidebarHistory tab="memos">
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
    <RequestError code={state.error ?? sourceError ?? error ?? (toolbarPreference.failed ? "storage_failed" : null)} />
    {!state.ready || (sources === null && !sourceError) ? <LoadingState label={getText("client.load")} /> : <>
      {state.permissionKnown && !state.editable && <p className="client-notice">{getText("client.readOnly")}</p>}
      <div className="daily-memo-title-bar">
        <label className="visually-hidden" htmlFor="daily-memo-title">{getText("dailyMemo.titleLabel")}</label>
        <input className="daily-memo-title-input" id="daily-memo-title" placeholder={getText("dailyMemo.titlePlaceholder")}
          value={state.title} maxLength={120} readOnly={readOnly}
          onCompositionStart={() => controller.setComposing(true)} onCompositionEnd={() => controller.setComposing(false)}
          onChange={event => controller.update({ title: event.target.value })} />
        <FormatToggle readOnly={readOnly} preference={toolbarPreference} />
      </div>
      <DailyMemoRichTextEditor
        key={`${dateKey}:${state.editorRevision}`} ref={editor} content={state.content} label={getText("client.memoContent")}
        preview={readOnly} placeholder={getText("client.memoPlaceholder")}
        sourcePresets={sources ?? []} sourceError={sourceError} toolbarExpanded={!readOnly && toolbarPreference.value} onChange={content => controller.update({ content })}
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
