import { useRef, useState } from "react";
import { LoadingState } from "@/components/ui/loading-state";
import { SidebarHistory, useSidebarSelection } from "@/features/shell/workspace-sidebar";
import { getText } from "@/i18n/get-text";
import type { LocalTranslation } from "@/translation/contracts";
import { historyDetail, type HistoryRow } from "./history-library-client";
import type { TranslationChange } from "./translation-change";
import { TranslationLibrary } from "./translation-library";
import { websiteTranslationClient } from "./translation-client";
import { TranslationWorkspace } from "./translation-workspace";

export function TranslationModule({ accountId, active }: { accountId: string; active: boolean }) {
  const revision = useRef(0);
  const [workspace, setWorkspace] = useState<{ key: number; record?: LocalTranslation }>({ key: 0 });
  const [loadingRecord, setLoadingRecord] = useState(false);
  const finishSelection = useSidebarSelection();

  async function openHistory(row: HistoryRow) {
    const key = ++revision.current;
    finishSelection?.();
    setLoadingRecord(true);
    try {
      const record = await historyDetail(accountId, row);
      if (key === revision.current) setWorkspace({ key, record });
    } finally {
      if (key === revision.current) setLoadingRecord(false);
    }
  }

  const [change, setChange] = useState<TranslationChange>();
  return <section className="translation-module">
    {loadingRecord && <LoadingState label={getText("translation.loading")} />}
    <div hidden={loadingRecord}>
      <TranslationWorkspace key={workspace.key} initialRecord={workspace.record} client={websiteTranslationClient} active={active} accountId={accountId}
        change={change} onChange={setChange} />
    </div>
    <SidebarHistory tab="translation"><TranslationLibrary onSelect={openHistory} accountId={accountId} change={change} onChange={setChange} /></SidebarHistory>
  </section>;
}
