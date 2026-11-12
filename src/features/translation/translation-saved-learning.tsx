
import { useEffect, useId, useRef, useState } from "react";
import { getText } from "@/i18n/get-text";
import type { LocalTranslation, TranslationAnalysisInput, TranslationRecord } from "@/translation/contracts";
import { saveCollectedAnalysis, websiteTranslationClient } from "./translation-client";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";
import { TranslationSettings } from "./translation-settings";
import { useTranslationSpeech } from "./translation-speech";
import { TranslationLearningContent } from "./translation-learning";

export function TranslationSavedLearning({ record, accountId, active, onStart, onSaved }: {
  record: TranslationRecord;
  accountId: string;
  active: boolean;
  onStart: () => void;
  onSaved: (record: LocalTranslation) => void;
}) {
  const [model, setModel] = useState<TranslationAnalysisInput["model"]>(record.learning?.analysis.model ?? "qwen");
  const [working, setWorking] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsId = useId();
  const speech = useTranslationSpeech(record.sourceLanguage === "en" ? record.text : record.translatedText, active);
  const controller = useRef<AbortController | null>(null);
  function stop() { controller.current?.abort(); controller.current = null; setWorking(false); }
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => { if (live) setWorking(false); });
    return () => { live = false; controller.current?.abort(); controller.current = null; };
  }, [active, record.id]);

  async function analyze() {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    onStart();
    setWorking(true); setError(""); setAnalysisText("");
    let saving = false;
    try {
      const analysis = await websiteTranslationClient.analyze({ text: record.text,
        sourceLanguage: record.sourceLanguage, targetLanguage: record.targetLanguage, model }, abort.signal, value => {
          if (!abort.signal.aborted) setAnalysisText(value);
        }, true);
      abort.signal.throwIfAborted();
      saving = true;
      const saved = await saveCollectedAnalysis(record.id, accountId, analysis, abort.signal);
      if (abort.signal.aborted) return;
      onSaved(saved);
      if (saved.localSaveFailed) setError(getText("translation.storageFailed"));
    } catch (failure) {
      if (!abort.signal.aborted) {
        const code = failure instanceof Error ? failure.message : "";
        setError(getText(code === "signedOut" ? "translation.signedOut" : code === "rateLimited" ? "translation.rateLimited" : saving ? "translation.analysisSaveFailed" : "translation.analysisUnavailable"));
      }
    } finally {
      if (!abort.signal.aborted) setWorking(false);
      if (controller.current === abort) controller.current = null;
    }
  }

  return <>
    <Button variant="ghost" size="icon" aria-label={getText("settings.shortLabel")} aria-expanded={settingsOpen} aria-controls={settingsId} onClick={() => setSettingsOpen(value => !value)}><SlidersHorizontal size={18} /></Button>
    <TranslationSettings id={settingsId} hidden={!settingsOpen} analysisModel={model} onAnalysisModel={setModel} analysisDisabled={working} speech={speech} />
    <TranslationLearningContent record={record} active={active} analysisModel={model} speech={speech} onStopAnalysis={stop}
      analysisWorking={working} analysisText={analysisText} analysisError={error} onAnalyze={() => void analyze()} />
  </>;
}
