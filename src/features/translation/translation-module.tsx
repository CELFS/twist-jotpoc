import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarHistory } from "@/features/shell/workspace-sidebar";
import { getText } from "@/i18n/get-text";
import type { TranslationChange } from "./translation-change";
import { TranslationLibrary } from "./translation-library";
import { websiteTranslationClient } from "./translation-client";
import { TranslationWorkspace } from "./translation-workspace";

export function TranslationModule({ accountId, active }: { accountId: string; active: boolean }) {
  const [instance, setInstance] = useState(0);
  const [change, setChange] = useState<TranslationChange>();
  return <section className="translation-module">
    <div className="workspace-toolbar">
      <Button variant="secondary" onClick={() => setInstance(value => value + 1)}>
        <Plus size={16} />{getText("client.newTranslation")}
      </Button>
    </div>
    <TranslationWorkspace key={instance} client={websiteTranslationClient} active={active} accountId={accountId}
      change={change} onChange={setChange} />
    <SidebarHistory tab="translation"><TranslationLibrary accountId={accountId} change={change} onChange={setChange} /></SidebarHistory>
  </section>;
}
