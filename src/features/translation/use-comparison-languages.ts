
import { useEffect, useRef, useState } from "react";
import { createRepositories } from "@/data/repositories";
import { subscribeToDataChanges } from "@/data/change-bus";
import { comparisonLanguages, type ComparisonLanguage } from "@/translation/comparison-contracts";

const key = "translation.comparisonLanguages";
export function useComparisonLanguages() {
  const [value, setValue] = useState<readonly ComparisonLanguage[]>(comparisonLanguages);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(false);
  const writing = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let live = true;
    let revision = 0;
    const load = () => {
      const current = ++revision;
      void createRepositories().settings.get(key).then(result => {
        const stored = result?.value;
        const selected = comparisonLanguages.filter(language => Array.isArray(stored) && stored.includes(language));
        if (live && current === revision) setValue(selected.length ? selected : comparisonLanguages);
      }).catch(() => { if (live) setFailed(true); }).finally(() => { if (live) setReady(true); });
    };
    load();
    const unsubscribe = subscribeToDataChanges(change => { if (change.entity === "settings" && change.id === key) load(); });
    return () => { live = false; mounted.current = false; unsubscribe(); };
  }, []);
  async function change(next: ComparisonLanguage[]) {
    const selected = comparisonLanguages.filter(language => next.includes(language));
    if (!ready || writing.current || !selected.length) return;
    writing.current = true; setSaving(true); setFailed(false);
    try { await createRepositories().settings.set(key, selected); if (mounted.current) setValue(selected); }
    catch { if (mounted.current) setFailed(true); }
    finally { writing.current = false; if (mounted.current) setSaving(false); }
  }
  return { value, ready, saving, failed, change };
}
