
import { useEffect, useRef, useState } from "react";
import { createRepositories } from "@/data/repositories";
import type { TranslationInput } from "@/translation/contracts";

const preferenceKey = "translation.sourceLanguage";
export function useTranslationDirection(initial?: Pick<TranslationInput, "sourceLanguage">) {
  const [sourceLanguage, setSourceLanguage] = useState<"en" | "zh">(initial?.sourceLanguage ?? "en");
  const [ready, setReady] = useState(!!initial);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let live = true;
    if (!initial) void createRepositories().settings.get(preferenceKey).then(value => {
      if (live) setSourceLanguage(value?.value === "zh" ? "zh" : "en");
    }).catch(() => undefined).finally(() => { if (live) setReady(true); });
    return () => { live = false; mounted.current = false; };
  }, [initial]);
  async function setLanguages(value: "en" | "zh") {
    setSaving(true);
    try {
      await createRepositories().settings.set(preferenceKey, value);
      if (mounted.current) setSourceLanguage(value);
    } finally { if (mounted.current) setSaving(false); }
  }
  return { languages: { sourceLanguage, targetLanguage: sourceLanguage === "en" ? "zh" as const : "en" as const }, setLanguages, restore: setSourceLanguage, ready, saving };
}
