import type { LocalTranslation, TranslationAnalysisInput, TranslationLearning } from "@/translation/contracts";
import type { TranslationClient, TranslationGeneration } from "./translation-client";

export type GenerationProgress = { record?: LocalTranslation; text?: string; translationWorking?: boolean; dictionary?: TranslationLearning['dictionary']; dictionaryLoading?: boolean; analysis?: TranslationLearning['analysis']; analysisText?: string; analysisWorking?: boolean; analysisError?: unknown; translationError?: unknown };

export async function generateTranslationTogether(client: TranslationClient, input: TranslationGeneration, signal: AbortSignal, analysisModel: TranslationAnalysisInput['model'] | undefined, onProgress: (value: GenerationProgress) => void, preservedLearning?: TranslationLearning, moduleSignals?: { translation: AbortSignal; analysis: AbortSignal }) {
  const translationSignal = moduleSignals ? AbortSignal.any([signal, moduleSignals.translation]) : signal;
  const analysisSignal = moduleSignals ? AbortSignal.any([signal, moduleSignals.analysis]) : signal;
  let record: LocalTranslation | undefined;
  const learning: TranslationLearning = preservedLearning ? { ...preservedLearning } : { dictionary: { status: "notRequested" }, analysis: { status: "notRequested", model: analysisModel ?? "qwen" } };
  let writes = Promise.resolve();
  const emit = (value: GenerationProgress) => { if (!signal.aborted) onProgress(value); };
  // Serialize persistence only; all provider requests and previews proceed independently.
  const save = () => {
    writes = writes.then(async () => {
      if (!record || signal.aborted) return;
      try { record = await client.enrich(record, { ...learning }, signal); }
      catch { record = { ...record, localSaveFailed: true, learning: { ...learning } }; }
      emit({ record });
    });
    return writes;
  };
  emit({ translationWorking: true, dictionaryLoading: !preservedLearning, analysisWorking: !preservedLearning && !!analysisModel, analysis: learning.analysis, dictionary: learning.dictionary, analysisText: "" });
  const analysisTask = !preservedLearning && analysisModel ? client.analyze({ text: input.text, sourceLanguage: input.sourceLanguage, targetLanguage: input.targetLanguage, model: analysisModel }, analysisSignal, analysisText => { if (!analysisSignal.aborted) emit({ analysisText }); }).then(async analysis => {
    if (analysisSignal.aborted) return;
    learning.analysis = analysis; emit({ analysis, analysisWorking: false, analysisText: "" }); await save();
  }).catch(async analysisError => {
    if (analysisSignal.aborted) { emit({ analysisWorking: false }); return; }
    learning.analysis = { status: "unavailable", model: analysisModel };
    emit({ analysis: learning.analysis, analysisError, analysisWorking: false }); await save();
  }) : Promise.resolve();
  const dictionaryTask = preservedLearning ? Promise.resolve() : client.dictionary(input.text, signal).catch(() => ({ status: "unavailable" as const })).then(async dictionary => {
    if (signal.aborted) return;
    learning.dictionary = dictionary; emit({ dictionary, dictionaryLoading: false }); await save();
  });
  const translationTask = client.generate(input, { signal: translationSignal, onText: text => { if (!translationSignal.aborted) emit({ text }); } }).then(async next => {
    translationSignal.throwIfAborted();
    record = next; emit({ record, translationWorking: false, text: "" }); await save();
  }).catch(translationError => { emit({ ...(translationSignal.aborted ? {} : { translationError }), translationWorking: false }); throw translationError; });
  const [translated] = await Promise.allSettled([translationTask, analysisTask, dictionaryTask]);
  signal.throwIfAborted();
  if (translated.status === "rejected") throw translated.reason;
  return record!;
}
