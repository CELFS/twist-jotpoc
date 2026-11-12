import { ErrorNotice } from "@/features/shell/notification-center";
import { Check, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getText } from "@/i18n/get-text";
import type { CollectionListItem } from "./collection-groups";
import { CollectionEditDrawer, type CollectionChanges } from "./collection-edit-drawer";

export function CollectionEntry({ item, onManage }: {
  item: CollectionListItem;
  onManage: (item: CollectionListItem, changes: CollectionChanges | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState<CollectionListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy() {
    if (window.getSelection()?.toString()) return;
    try {
      await navigator.clipboard.writeText(item.text ?? item.anchor.exact);
      setCopied(true); setError("");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch { setError(getText("collections.copyFailed")); }
  }
  async function remove() {
    if (busy) return;
    setBusy(true); setError("");
    try { await onManage(item, null); }
    catch (error) { setError(getText(error instanceof Error && error.message === "conflict" ? "collections.conflict" : "collections.saveFailed")); }
    finally { setBusy(false); }
  }
  return (
    <li className="collection-entry">
      <span className="collection-kind">{getText(`collections.${item.kind}`)}</span>
      <div className="collection-entry-copy">
        <p className="collection-text collection-copy-target" role="button" tabIndex={0} title={getText("collections.copy")}
          onClick={() => void copy()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void copy(); } }}>
          <span className="collection-mark" data-kind={item.kind}>{item.text ?? item.anchor.exact}</span>
          {copied && <Check className="collection-copied" size={15} aria-label={getText("collections.copied")} />}
        </p>
        {item.note && <p className="collection-note">{item.note}</p>}
        {error && <ErrorNotice text={error} />}
      </div>
      <div className="collection-entry-actions">
        <Button size="icon" variant="ghost" disabled={busy} aria-label={getText("collections.edit")} title={getText("collections.edit")} onClick={() => setEditing(item)}><Pencil size={15} /></Button>
        <Button size="icon" variant="ghost" disabled={busy} aria-label={getText("collections.delete")} title={getText("collections.delete")} onClick={() => void remove()}><Trash2 size={15} /></Button>
      </div>
      {editing && <CollectionEditDrawer item={editing} onClose={() => setEditing(null)} onSave={(changes) => onManage(editing, changes)} />}
    </li>
  );
}
