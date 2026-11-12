
import { useEffect, useRef, useState } from "react";
import { createRepositories } from "@/data/repositories";
import { subscribeToDataChanges } from "@/data/change-bus";

export function useTranslationPreference(key: string, defaultValue = false) {
  const [value, setValue] = useState(defaultValue);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let live = true;
    let revision = 0;
    const load = () => {
      const current = ++revision;
      void createRepositories().settings.get(key).then(result => {
        if (live && current === revision) setValue(typeof result?.value === "boolean" ? result.value : defaultValue);
      }).catch(() => { if (live) setFailed(true); }).finally(() => { if (live) setReady(true); });
    };
    load();
    const unsubscribe = subscribeToDataChanges(change => { if (change.entity === "settings" && change.id === key) load(); });
    return () => { live = false; mounted.current = false; unsubscribe(); };
  }, [key, defaultValue]);
  async function toggle() {
    if (!ready || saving) return;
    setSaving(true); setFailed(false);
    try { await createRepositories().settings.set(key, !value); if (mounted.current) setValue(!value); }
    catch { if (mounted.current) setFailed(true); }
    finally { if (mounted.current) setSaving(false); }
  }
  return { value, ready, saving, failed, toggle };
}
