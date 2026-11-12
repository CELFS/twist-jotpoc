import { ErrorNotice } from "@/features/shell/notification-center";
import { InfoHint } from "@/components/ui/info-hint";
import { LoadingState } from "@/components/ui/loading-state";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getText, type MessageKey } from "@/i18n/get-text";
import type { LocalTranslation } from "@/translation/contracts";
import { historyDetail, historyPage, removeHistoryRow, type Cursor, type HistoryRow } from "./history-library-client";
import { websiteTranslationClient } from "./translation-client";
import type { TranslationChange } from "./translation-change";
import { TranslationPreviewDrawer } from "./translation-preview-drawer";
import { TranslationWorkspace } from "./translation-workspace";
import { TranslationDeleteConfirmation } from "./translation-delete-confirmation";

export function TranslationLibrary({ accountId, change, onChange }: { accountId: string; change?: TranslationChange; onChange: (change: TranslationChange) => void }) {
  const [items, setItems] = useState<HistoryRow[]>([]);
  const [more, setMore] = useState(false);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | "">("");
  const [preview, setPreview] = useState<LocalTranslation | null>(null);
  const [confirm, setConfirm] = useState<HistoryRow | null>(null);
  const request = useRef(0);
  const load = useCallback(async (cursor?: Cursor) => {
    const id = ++request.current;
    setLoading(true); setError("");
    try {
      const page = await historyPage(accountId, cursor);
      if (request.current !== id) return;
      setItems(previous => cursor ? [...previous, ...page.rows.filter(row => !previous.some(item => item.id === row.id))] : page.rows);
      setMore(page.more); setOffline(page.cloudUnavailable);
    } catch { if (request.current === id) setError("translation.readFailed"); }
    finally { if (request.current === id) setLoading(false); }
  }, [accountId]);
  useEffect(() => {
    const refresh = () => void load();
    refresh();
    window.addEventListener("focus", refresh);
    return () => { request.current++; window.removeEventListener("focus", refresh); };
  }, [load, change]);

  async function act(row: HistoryRow, action: "preview" | "collect" | "remove") {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (action === "remove") {
        const record = await removeHistoryRow(accountId, row);
        setConfirm(null);
        onChange({ kind: row.savedBy ? "uncollect" : "remove", record });
      } else {
        const record = await historyDetail(accountId, row);
        if (action === "preview") { setPreview(record); return; }
        const saved = await websiteTranslationClient.collect(record);
        onChange({ kind: "collect", record: saved });
      }
    } catch { setError(action === "preview" ? "translation.readFailed" : action === "collect" ? "translation.saveFailed" : "translation.deleteFailed"); }
    finally { setBusy(false); }
  }

  return <section className="translation-library">
    <header><InfoHint text={getText("translation.libraryHint")} /><Button size="icon" variant="ghost" disabled={loading || busy}
      aria-label={getText("translation.refresh")} onClick={() => void load()}><RefreshCw size={16} /></Button></header>
    {offline && <ErrorNotice text={getText("translation.cloudUnavailable")} />}
    {error && <ErrorNotice text={getText(error)} />}
    {items.map(row => <article className="sidebar-translation-row" key={row.id}>
      <button className="history-item" type="button" disabled={busy} onClick={() => void act(row, "preview")}>
        <strong lang={row.sourceLanguage}>{row.text}</strong><span lang={row.targetLanguage}>{row.translatedText}</span>
      </button>
      <div className="sidebar-row-actions">
        {!row.savedBy && <span className="translation-tag">{getText("translation.local")}</span>}
        <Button size="icon" variant="ghost" disabled={busy || offline} aria-label={getText("translation.delete")}
          onClick={() => row.savedBy ? setConfirm(row) : void act(row, "remove")}><Trash2 size={14} /></Button>
        <Button size="icon" variant="ghost" className="translation-collect-button" data-collected={Boolean(row.savedBy) || undefined}
          disabled={busy || offline || Boolean(row.savedBy)} title={getText(row.savedBy ? "translation.saved" : "translation.collect")} aria-label={getText(row.savedBy ? "translation.saved" : "translation.collect")}
          onClick={() => void act(row, "collect")}><Star size={14} aria-hidden="true" /></Button>
      </div>
    </article>)}
    {loading && <LoadingState compact rows={items.length ? 1 : 3} label={getText("translation.loading")} />}
    {!items.length && !loading && !error && <p>{getText("translation.emptyHistory")}</p>}
    {more && items.length > 0 && <Button variant="secondary" disabled={busy || loading} onClick={() => {
      const { id, createdAt } = items[items.length - 1]; void load({ id, createdAt });
    }}>{getText("translation.more")}</Button>}
    {preview && <TranslationPreviewDrawer title={getText("translation.preview")} onClose={() => setPreview(null)}>
      <TranslationWorkspace key={preview.id} initialRecord={preview} accountId={accountId} active client={websiteTranslationClient} change={change} onChange={onChange} />
    </TranslationPreviewDrawer>}
    {confirm && <TranslationDeleteConfirmation source="cloud" busy={busy} feedback={error ? getText(error) : undefined}
      onCancel={() => setConfirm(null)} onConfirm={() => void act(confirm, "remove")} />}
  </section>;
}
