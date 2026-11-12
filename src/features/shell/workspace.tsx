import { lazy, Suspense, useEffect, useState } from "react";
import { Languages, NotebookPen, StickyNote } from "lucide-react";
import { z } from "zod";
import { Tabs } from "@/components/ui/tabs";
import { getText } from "@/i18n/get-text";
import { MemoWorkspace } from "@/features/daily-memos/memo-workspace";
import { getApi } from "@/data/cloud-api";
import { publishDataChange } from "@/data/change-bus";
import { stopMemoControllers } from "@/features/daily-memos/memo-controller";
import type { TranslationChange } from "@/features/translation/translation-change";

const NotesWorkspace = lazy(() => import("@/features/source-notes/notes-workspace").then(module => ({ default: module.NotesWorkspace })));
const TranslationModule = lazy(() => import("@/features/translation/translation-module").then(module => ({ default: module.TranslationModule })));

export function Workspace({ accountId, onTranslationChange }: {
  accountId: string;
  onTranslationChange: (change: TranslationChange) => void;
}) {
  const [tab, setTab] = useState<"memos" | "translation" | "notes">("memos");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [visited, setVisited] = useState({ translation: false, notes: false });
  const selectTab = (next: "memos" | "translation" | "notes") => {
    if (next !== "memos") setVisited(previous => ({ ...previous, [next]: true }));
    setTab(next);
  };
  useEffect(() => {
    const navigate = (event: Event) => {
      const id: unknown = (event as CustomEvent).detail;
      if (typeof id === "string") { setNoteId(id); setVisited(previous => ({ ...previous, notes: true })); setTab("notes"); }
    };
    window.addEventListener("jotpoc:open-note", navigate);
    return () => { window.removeEventListener("jotpoc:open-note", navigate); stopMemoControllers(); };
  }, [accountId]);

  useEffect(() => {
    let active = true;
    let running = false;
    let checkpoint: string | null = null;
    const poll = async () => {
      if (!active || running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const state = await getApi("sync-state", z.object({
          sync: z.object({ epoch: z.string(), checkpoint: z.number() }).nullable(),
          dailyMemoEditable: z.boolean(),
        }));
        if (!active) return;
        const next = JSON.stringify(state);
        if (checkpoint !== null && checkpoint !== next) {
          publishDataChange({ entity: "dailyMemos", id: "*" });
          publishDataChange({ entity: "sourceNotes", id: "*" });
          publishDataChange({ entity: "webResources", id: "*" });
        }
        checkpoint = next;
      } catch { /* Editing views retain drafts and expose errors on their next sync attempt. */ }
      finally { running = false; }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 30_000);
    const resume = () => { if (document.visibilityState === "visible") void poll(); };
    const online = () => {
      void poll();
      publishDataChange({ entity: "dailyMemos", id: "*" });
      publishDataChange({ entity: "sourceNotes", id: "*" });
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", resume);
    return () => { active = false; clearInterval(timer); window.removeEventListener("online", online); document.removeEventListener("visibilitychange", resume); };
  }, [accountId]);

  return <div className="workspace">
    <Tabs id="workspace" ariaLabel={getText("client.tabs")} value={tab} onValueChange={selectTab}
      items={[
        { value: "translation", label: getText("client.translation"), icon: <Languages size={17} /> },
        { value: "memos", label: getText("client.memos"), icon: <StickyNote size={17} /> },
        { value: "notes", label: getText("client.notes"), icon: <NotebookPen size={17} /> },
      ]} />
    <div id="workspace-panel-translation" className="workspace-panel" role="tabpanel" aria-labelledby="workspace-tab-translation" hidden={tab !== "translation"}>
      {visited.translation && <Suspense fallback={<p role="status">{getText("client.load")}</p>}><TranslationModule accountId={accountId} active={tab === "translation"} onChange={onTranslationChange} /></Suspense>}
    </div>
    <div id="workspace-panel-memos" className="workspace-panel" role="tabpanel" aria-labelledby="workspace-tab-memos" hidden={tab !== "memos"}>
      <MemoWorkspace accountId={accountId} />
    </div>
    <div id="workspace-panel-notes" className="workspace-panel" role="tabpanel" aria-labelledby="workspace-tab-notes" hidden={tab !== "notes"}>
      {visited.notes && <Suspense fallback={<p role="status">{getText("client.load")}</p>}><NotesWorkspace selectedId={noteId} onSelect={setNoteId} active={tab === "notes"} /></Suspense>}
    </div>
  </div>;
}
