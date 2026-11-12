import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getText } from "@/i18n/get-text";
import type { LocalTranslation } from "@/translation/contracts";
import type { TranslationChange } from "./translation-change";
import { websiteTranslationClient } from "./translation-client";
import { TranslationWorkspace } from "./translation-workspace";
import { RequestError } from "@/features/shell/request-error";

export function TranslationModule({ accountId, active, onChange }: {
  accountId: string;
  active: boolean;
  onChange: (change: TranslationChange) => void;
}) {
  const [history, setHistory] = useState<LocalTranslation[]>([]);
  const [selected, setSelected] = useState<LocalTranslation>();
  const [instance, setInstance] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocalTranslation | null>(null);
  const load = useCallback(async (before?: { createdAt: number; id: string }) => {
    setLoading(true); setError(null);
    try {
      const page = await websiteTranslationClient.history(before);
      setHistory(previous => before ? [...previous, ...page.filter(row => !previous.some(item => item.id === row.id))] : page);
      setMore(page.length === 25);
    } catch { setError("storage_failed"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (active) void load(); }, [active, load]);

  return <section className="translation-module">
    <div className="workspace-toolbar">
      <Button variant="secondary" onClick={() => { setSelected(undefined); setInstance(value => value + 1); }}>
        <Plus size={16} />{getText("client.newTranslation")}
      </Button>
    </div>
    <TranslationWorkspace key={`${selected?.id ?? "new"}:${instance}`}
      client={websiteTranslationClient} initialRecord={selected} active={active} accountId={accountId}
      onChange={change => { onChange(change); void load(); }} />
    <section className="translation-local-history">
      <div className="workspace-toolbar">
        <strong>{getText("client.localHistory")}</strong>
        <Button variant="ghost" size="icon" aria-label={getText("client.refresh")} disabled={loading} onClick={() => void load()}><RefreshCw size={16} /></Button>
      </div>
      <RequestError code={error} />
      {!history.length && !loading && <p>{getText("client.noHistory")}</p>}
      {history.map(record => <div className="translation-history-row" key={record.id}>
        <button type="button" className="translation-history-select" onClick={() => { setSelected(record); setInstance(value => value + 1); }}>
          <strong>{record.text.slice(0, 100)}</strong><span>{record.translatedText.slice(0, 160)}</span>
        </button>
        <Button variant="ghost" size="icon" aria-label={getText("client.delete")} onClick={() => setDeleteTarget(record)}><Trash2 size={16} /></Button>
      </div>)}
      {more && history.length > 0 && <Button variant="secondary" disabled={loading} onClick={() => {
        const last = history[history.length - 1];
        void load({ createdAt: last.createdAt, id: last.id });
      }}>{getText("client.more")}</Button>}
    </section>
    <ConfirmDialog open={Boolean(deleteTarget)} busy={loading}
      title={getText("translation.deleteLocalTitle")} description={getText("translation.deleteLocalDescription")}
      closeLabel={getText("common.close")} cancelLabel={getText("common.cancel")} confirmLabel={getText("client.delete")}
      onCancel={() => setDeleteTarget(null)} onConfirm={() => {
        if (!deleteTarget) return;
        void websiteTranslationClient.remove(deleteTarget.id).then(() => {
          onChange({ kind: "remove", record: deleteTarget });
          setDeleteTarget(null);
          return load();
        }).catch(() => setError("storage_failed"));
      }} />
  </section>;
}
