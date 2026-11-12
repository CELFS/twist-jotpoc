
import { useEffect, useRef, useState } from "react";
import { createRepositories } from "@/data/repositories";
import { translationModelSchema, type TranslationInput } from "@/translation/contracts";

const preferenceKey = "translation.model";
export function useTranslationModel(initial?: TranslationInput["model"]) {
  const [model, setModel] = useState<TranslationInput["model"]>(initial ?? "qwen");
  const [ready, setReady] = useState(!!initial);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let live = true;
    if (!initial) void createRepositories().settings.get(preferenceKey).then(result => {
      const parsed = translationModelSchema.safeParse(result?.value);
      if (live) setModel(parsed.success ? parsed.data : "qwen");
    }).catch(() => { if (live) setFailed(true); }).finally(() => { if (live) setReady(true); });
    return () => { live = false; mounted.current = false; };
  }, [initial]);
  async function selectModel(value: TranslationInput["model"]) {
    setSaving(true); setFailed(false);
    try {
      await createRepositories().settings.set(preferenceKey, value);
      if (mounted.current) setModel(value);
    } catch { if (mounted.current) setFailed(true); }
    finally { if (mounted.current) setSaving(false); }
  }
  return { model, selectModel, restore: setModel, ready, saving, failed };
}
