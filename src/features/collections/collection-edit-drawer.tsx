import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { TextareaField } from "@/components/ui/textarea-field";
import { getText } from "@/i18n/get-text";
import type { CollectionListItem } from "./collection-groups";

export type CollectionChanges = { text: string; note: string; kind: CollectionListItem["kind"] };

export function CollectionEditDrawer({ item, onClose, onSave }: {
  item: CollectionListItem;
  onClose: () => void;
  onSave: (changes: CollectionChanges) => Promise<void>;
}) {
  const [text, setText] = useState(item.text ?? item.anchor.exact);
  const [note, setNote] = useState(item.note ?? "");
  const [kind, setKind] = useState(item.kind);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (saving || !text.trim()) return;
    setSaving(true); setError("");
    try { await onSave({ text: text.trim(), note, kind }); onClose(); }
    catch (error) { setError(getText(error instanceof Error && error.message === "conflict" ? "collections.conflict" : "collections.saveFailed")); }
    finally { setSaving(false); }
  }
  return (
    <Drawer className="collection-editor-drawer" contentClassName="collection-editor-content custom-scrollbar" ariaLabel={getText("collections.edit")} onClose={() => { if (!saving) onClose(); }}
      header={<h2 className="collection-editor-heading">{getText("collections.edit")}</h2>}
      footer={<><Button variant="ghost" disabled={saving} onClick={onClose}>{getText("collections.cancel")}</Button><Button disabled={saving || !text.trim()} onClick={() => void save()}>{getText(saving ? "collections.saving" : "collections.save")}</Button></>}>
      <div className="collection-editor">
        <div className="collection-kind-options" role="group" aria-label={getText("collections.type")}>
          {(["word", "phrase", "sentence"] as const).map((value) => <Button key={value} disabled={saving} variant={value === kind ? "primary" : "secondary"} aria-pressed={value === kind} onClick={() => setKind(value)}>{getText(`collections.${value}`)}</Button>)}
        </div>
        <TextareaField label={getText("collections.copyText")} value={text} maxLength={10000} rows={4} disabled={saving} onChange={(event) => setText(event.target.value)} />
        <TextareaField label={getText("collections.note")} value={note} maxLength={10000} rows={4} disabled={saving} onChange={(event) => setNote(event.target.value)} />
        <details><summary>{getText("collections.original")}</summary><p className="collection-text">{item.anchor.exact}</p></details>
        {error && <p className="collection-action-error" role="alert">{error}</p>}
      </div>
    </Drawer>
  );
}
