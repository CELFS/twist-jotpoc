import { lazy, Suspense, useEffect, useState } from "react";
import { z } from "zod";
import { getText } from "@/i18n/get-text";
import { MemoWorkspace } from "@/features/daily-memos/memo-workspace";
import { getApi } from "@/data/cloud-api";
import { publishDataChange } from "@/data/change-bus";
import { stopMemoControllers } from "@/features/daily-memos/memo-controller";

const NotesWorkspace = lazy(() => import("@/features/source-notes/notes-workspace").then(module => ({ default: module.NotesWorkspace })));
const TranslationModule = lazy(() => import("@/features/translation/translation-module").then(module => ({ default: module.TranslationModule })));

const CollectionsPanel = lazy(() => import("@/features/collections/collections-page").then(module => ({ default: module.CollectionsPage })));

export type WorkspaceTab = "memos" | "translation" | "notes" | "collections";

export function Workspace({ accountId, tab, setTab }: {
  tab: WorkspaceTab;
  setTab: (tab: WorkspaceTab) => void;
  accountId: string;
}) {

  const [noteId, setNoteId] = useState<string | null>(null);
  const [visited, setVisited] = useState({ translation: false, notes: false, collections: false });
  useEffect(() => {
    if (tab !== "memos") setVisited(previous => previous[tab] ? previous : { ...previous, [tab]: true });
  }, [tab]);
  useEffect(() => {
    const navigate = (event: Event) => {
      const id: unknown = (event as CustomEvent).detail;
      if (typeof id === "string") { setNoteId(id); setTab("notes"); }
    };
    window.addEventListener("jotpoc:open-note", navigate);
    return () => { window.removeEventListener("jotpoc:open-note", navigate); stopMemoControllers(); };
  }, [accountId, setTab]);

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
    <div id="workspace-panel-collections" className="workspace-panel app-content custom-scrollbar" role="tabpanel" aria-labelledby="workspace-tab-collections" hidden={tab !== "collections"}>
      {visited.collections && <Suspense fallback={<p role="status">{getText("client.load")}</p>}>
        <CollectionsPanel active={tab === "collections"} />
      </Suspense>}
    </div>
    <div id="workspace-panel-translation" className="workspace-panel app-content custom-scrollbar" role="tabpanel" aria-labelledby="workspace-tab-translation" hidden={tab !== "translation"}>
      {visited.translation && <Suspense fallback={<p role="status">{getText("client.load")}</p>}><TranslationModule accountId={accountId} active={tab === "translation"} /></Suspense>}
    </div>
    <div id="workspace-panel-memos" className="workspace-panel app-content custom-scrollbar" role="tabpanel" aria-labelledby="workspace-tab-memos" hidden={tab !== "memos"}>
      <MemoWorkspace accountId={accountId} />
    </div>
    <div id="workspace-panel-notes" className="workspace-panel app-content custom-scrollbar" role="tabpanel" aria-labelledby="workspace-tab-notes" hidden={tab !== "notes"}>
      {visited.notes && <Suspense fallback={<p role="status">{getText("client.load")}</p>}><NotesWorkspace selectedId={noteId} onSelect={setNoteId} active={tab === "notes"} /></Suspense>}
    </div>
  </div>;
}
