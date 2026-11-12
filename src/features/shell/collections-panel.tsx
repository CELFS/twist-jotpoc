import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { getText } from "@/i18n/get-text";
import { CollectionsPage } from "@/features/collections/collections-page";
import { TranslationLibrary } from "@/features/translation/translation-library";
import type { TranslationChange } from "@/features/translation/translation-change";

export function CollectionsPanel({ accountId, change, onChange }: {
  accountId: string;
  change?: TranslationChange;
  onChange: (change: TranslationChange) => void;
}) {
  const [tab, setTab] = useState<"web" | "translation">("web");
  return <section className="collections-panel">
    <Tabs id="collections" ariaLabel={getText("client.collections")} value={tab} onValueChange={setTab}
      items={[{ value: "web", label: getText("translation.webCollections") }, { value: "translation", label: getText("client.savedTranslations") }]} />
    <div id="collections-panel-web" role="tabpanel" aria-labelledby="collections-tab-web" hidden={tab !== "web"}>
      <CollectionsPage embedded active={tab === "web"} />
    </div>
    <div id="collections-panel-translation" role="tabpanel" aria-labelledby="collections-tab-translation" hidden={tab !== "translation"}>
      <TranslationLibrary accountId={accountId} active={tab === "translation"} change={change} onChange={onChange} />
    </div>
  </section>;
}
