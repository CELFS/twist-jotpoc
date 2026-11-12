
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, MessageCircle, RefreshCw, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { getText } from "@/i18n/get-text";
import { getDatabase } from "@/data/database";
import { translationCursorSchema, translationRecordSchema, translationSummarySchema, type TranslationRecord, type TranslationSummary } from "@/translation/contracts";
import { translationRequest } from "./translation-client";
import { TranslationSavedLearning } from "./translation-saved-learning";
import { TranslationPreviewDrawer } from "./translation-preview-drawer";
import { TranslationSourceCard } from "./translation-source-card";
import { TranslationResultToggle } from "./translation-result-toggle";
import { TranslationDeleteConfirmation } from "./translation-delete-confirmation";
import type { TranslationChange } from "./translation-change";

const pageSchema = z.object({ items: z.array(translationSummarySchema), nextCursor: translationCursorSchema.nullable(), accountId: z.string() });
export function TranslationLibrary({ accountId, active = true, change, onChange, suspended = false, onDiscuss }: {
  accountId: string;
  active?: boolean;
  change?: TranslationChange;
  onChange?: (change: TranslationChange) => void;
  suspended?: boolean;
  onDiscuss?: (record: TranslationRecord) => void;
}) {
  const [items, setItems] = useState<TranslationSummary[]>([]);
  const [cursor, setCursor] = useState<z.infer<typeof translationCursorSchema> | null>(null);
  const [selected, setSelected] = useState<TranslationRecord | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TranslationRecord | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const deleteBusy = useRef(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState(true);
  const loaded = useRef(false);
  const revision = useRef(0);
  const detailRevision = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const detailController = useRef<AbortController | null>(null);
  const currentPreview = useRef<string | null>(null);
  const details = useRef(new Map<string, TranslationRecord>());
  const mutations = useRef(new Map<string, TranslationChange>());
  const mounted = useRef(true);
  const load = useCallback(async (after: z.infer<typeof translationCursorSchema> | null = null) => {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const current = ++revision.current;
    setLoading(true); setError("");
    try {
      const page = pageSchema.parse(await translationRequest(`?cursor=${encodeURIComponent(JSON.stringify(after))}`, undefined, abort.signal));
      if (page.accountId !== accountId) throw new Error("signedOut");
      if (!mounted.current || current !== revision.current || abort.signal.aborted) return;
      const rows = page.items.filter(item => mutations.current.get(item.id)?.kind !== "uncollect");
      setItems(previous => {
        const merged = after ? [...previous, ...rows.filter(item => !previous.some(entry => entry.id === item.id))] : rows;
        for (const edit of mutations.current.values()) {
          if (edit.kind === "collect" && !merged.some(item => item.id === edit.record.id)) merged.push(translationSummarySchema.strip().parse(edit.record));
        }
        return merged.sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1));
      });
      setCursor(page.nextCursor); loaded.current = true;
    } catch (failure) { if (mounted.current && current === revision.current && !abort.signal.aborted) setError(getText(failure instanceof Error && failure.message === "signedOut" ? "translation.signedOut" : "translation.readFailed")); }
    finally { if (mounted.current && current === revision.current) setLoading(false); }
  }, [accountId]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; revision.current += 1; detailRevision.current += 1; controller.current?.abort(); detailController.current?.abort(); };
  }, []);
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => {
      if (!live) return;
      if (active && !loaded.current) void load();
      if (!active) { currentPreview.current = null; setSelected(null); setPreviewId(null); setDeleteTarget(null); }
    });
    return () => { live = false; controller.current?.abort(); detailController.current?.abort(); };
  }, [active, load]);
  useEffect(() => {
    if (!change || change.kind !== "collect" || change.record.savedBy !== accountId) return;
    mutations.current.set(change.record.id, change);
    let live = true;
    void Promise.resolve().then(() => {
      if (!live) return;
      setItems(previous => previous.some(item => item.id === change.record.id) ? previous : [translationSummarySchema.strip().parse(change.record), ...previous]);
    });
    return () => { live = false; };
  }, [change, accountId]);
  function close() {
    currentPreview.current = null;
    detailRevision.current += 1; detailController.current?.abort();
    setPreviewId(null); setSelected(null); setDetailError(""); setNotice(""); setDeleteTarget(null);
  }
  async function open(id: string) {
    currentPreview.current = id;
    detailController.current?.abort();
    const abort = new AbortController(); detailController.current = abort;
    const current = ++detailRevision.current;
    setPreviewId(id); setSelected(null); setDetailLoading(true); setDetailError(""); setNotice("");
    try {
      let record = details.current.get(id);
      if (!record) {
        const result = await translationRequest(`/detail?id=${encodeURIComponent(id)}`, undefined, abort.signal);
        if (result.accountId !== accountId) throw new Error("signedOut");
        record = translationRecordSchema.parse(result.record);
      }
      if (!mounted.current || abort.signal.aborted || current !== detailRevision.current) return;
      details.current.delete(id); details.current.set(id, record);
      if (details.current.size > 32) details.current.delete(details.current.keys().next().value!);
      setSelected(record);
    } catch { if (mounted.current && current === detailRevision.current && !abort.signal.aborted) setDetailError(getText("translation.readFailed")); }
    finally { if (mounted.current && current === detailRevision.current) setDetailLoading(false); }
  }
  async function remove(record: TranslationRecord) {
    if (deleteBusy.current) return;
    deleteBusy.current = true; setDeleting(true); setDeleteError("");
    try {
      const result = await translationRequest("/delete", { id: record.id });
      if (result.accountId !== accountId) throw new Error("signedOut");
      const database = getDatabase();
      // Patch only the collection flag so concurrent dictionary or AI results survive.
      const local = await database.transaction("rw", database.localTranslations, async () => {
        const current = await database.localTranslations.get(record.id);
        if (current?.savedBy !== accountId) return undefined;
        await database.localTranslations.update(record.id, { savedBy: undefined });
        return { ...current, savedBy: undefined };
      });
      if (!mounted.current) return;
      mutations.current.set(record.id, { kind: "uncollect", record });
      details.current.delete(record.id); setItems(current => current.filter(item => item.id !== record.id));
      if (currentPreview.current === record.id) close();
      if (local) onChange?.({ kind: "uncollect", record: local });
      setDeleteTarget(null);
    } catch { if (mounted.current) setDeleteError(getText("translation.deleteFailed")); }
    finally { deleteBusy.current = false; if (mounted.current) setDeleting(false); }
  }
  return <section className="translation-library" aria-label={getText("translation.translationCollections")}>
    <header><h2>{getText("translation.translationCollections")}</h2><Button variant="ghost" size="icon" aria-label={getText("translation.refresh")} disabled={loading || deleting} onClick={() => { mutations.current.clear(); details.current.clear(); void load(); }}><RefreshCw size={16} /></Button></header>
    {error && <p role="alert" className="translation-error">{error}</p>}
    {!items.length && !loading && !error && <p>{getText("translation.emptyFavorites")}</p>}
    <div className="translation-library-list">{items.map(item => <button type="button" key={item.id} className="translation-history-open" onClick={() => void open(item.id)}><span lang={item.sourceLanguage === "en" ? "en" : "zh-CN"} title={item.text}>{item.text}</span><span lang={item.targetLanguage === "en" ? "en" : "zh-CN"} title={item.translatedText}>{item.translatedText}</span></button>)}</div>
    {loading && <LoadingState label={getText("translation.loading")} rows={items.length ? 1 : 3} />}
    {cursor && <Button variant="secondary" disabled={loading} onClick={() => void load(cursor)}>{getText("translation.more")}</Button>}
    {previewId && active && !suspended && <TranslationPreviewDrawer title={getText("translation.preview")} onClose={close}>
      {detailLoading && <LoadingState label={getText("translation.loading")} />}
      {detailError && <p role="alert" className="translation-error">{detailError}</p>}
      {!selected && !detailLoading && <Button variant="secondary" onClick={() => void open(previewId)}>{getText("translation.refresh")}</Button>}
      {selected && <article className="translation-cloud-preview">
        <p lang={selected.sourceLanguage === "zh" ? "zh-CN" : "en"}>{selected.text}</p>
        <TranslationResultToggle status={<span className="translation-tag">{getText("translation.saved")}</span>} onExpandedChange={setExpanded}
          actions={<>
            {onDiscuss && <Button variant="ghost" size="icon" aria-label={getText("translation.conversationOpen")} title={getText("translation.conversationOpen")} onClick={() => onDiscuss(selected)}><MessageCircle size={15} /></Button>}
            <Button variant="ghost" size="icon" aria-label={getText("translation.copy")} title={getText("translation.copy")} onClick={() => { void navigator.clipboard.writeText(selected.translatedText).then(() => setNotice(getText("translation.copied"))).catch(() => setDetailError(getText("translation.copyFailed"))); }}><Copy size={15} /></Button>
            <Button variant="ghost" disabled={deleting} onClick={() => { setDeleteError(""); setDeleteTarget(selected); }}><Trash2 size={15} />{getText("translation.delete")}</Button>
          </>}>
          <div className="translation-reading-block"><p lang={selected.targetLanguage === "zh" ? "zh-CN" : "en"}>{selected.translatedText}</p></div>
          <TranslationSavedLearning key={selected.id} record={selected} accountId={accountId} active={active && expanded} onStart={() => details.current.delete(selected.id)} onSaved={record => {
            details.current.set(record.id, record);
            setSelected(current => current?.id === record.id ? record : current);
            onChange?.({ kind: "update", record });
          }} />
          {selected.sourceUrl && <TranslationSourceCard url={selected.sourceUrl} title={selected.pageTitle} />}
        </TranslationResultToggle>
      </article>}
      {notice && <p role="status">{notice}</p>}
    </TranslationPreviewDrawer>}
    {deleteTarget && active && !suspended && <TranslationDeleteConfirmation source="cloud" busy={deleting} feedback={deleteError}
      onCancel={() => { if (!deleteBusy.current) setDeleteTarget(null); }} onConfirm={() => void remove(deleteTarget)} />}
  </section>;
}
