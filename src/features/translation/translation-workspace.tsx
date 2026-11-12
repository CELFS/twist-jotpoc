
import { generationErrorCode } from '@/translation/generation-error';
import { ArrowLeftRight, Copy, Languages, MessageCircle, RefreshCw, SlidersHorizontal, Square, Star, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { GenerationState } from "@/components/ui/generation-state";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { TranslationSettings } from "./translation-settings";
import { useTranslationSpeech } from "./translation-speech";
import { getText } from "@/i18n/get-text";
import { type LocalTranslation, type TranslationInput, type TranslationAnalysisInput, type TranslationLearning, type TranslationDictionary } from "@/translation/contracts";
import type { TranslationClient, TranslationSource } from "./translation-client";

import { generateTranslationTogether } from "./translation-generation";
import { useTranslationModel } from "./use-translation-model";
import { useTranslationDirection } from "./use-translation-direction";
import { TranslationVersions } from "./translation-versions";
import { TranslationComparison } from "./translation-comparison";
import { TranslationLearningContent } from "./translation-learning";
import { TranslationSourceCard } from "./translation-source-card";
import { TranslationResultToggle } from "./translation-result-toggle";
import type { TranslationChange } from "./translation-change";

type Props = {
  client: TranslationClient;
  initial?: TranslationSource & { text: string };
  initialRecord?: LocalTranslation;
  autoTranslate?: boolean;
  active?: boolean;
  accountId?: string;
  change?: TranslationChange;
  onChange?: (change: TranslationChange) => void;
  onDiscuss?: (record: LocalTranslation) => void;
};
function errorText(error: unknown, fallback: "failed" | "readFailed" | "saveFailed" | "analysisUnavailable") {
  const code = error instanceof Error ? error.message : "";
  return getText(`translation.${generationErrorCode(error) ?? (code === "signedOut" || code === "rateLimited" || code === "storageFailed" ? code : fallback)}`);
}

export function TranslationWorkspace({ client, initial, initialRecord, autoTranslate = false, active = true, accountId, change, onChange, onDiscuss }: Props) {
  const [text, setText] = useState(initialRecord?.text ?? initial?.text ?? "");
  const { model, selectModel, restore: setModel, ready: modelReady, saving: savingModel, failed: modelPreferenceFailed } = useTranslationModel(initialRecord?.model);
  const { languages, setLanguages, restore: restoreLanguage, ready: languagesReady, saving: savingLanguages } = useTranslationDirection(initialRecord);
  const [source, setSource] = useState<TranslationSource>(() => ({ originalText: initialRecord?.originalText ?? initial?.originalText ?? "", sourceUrl: initialRecord?.sourceUrl ?? initial?.sourceUrl, pageTitle: initialRecord?.pageTitle ?? initial?.pageTitle ?? "" }));
  const [record, setRecord] = useState<LocalTranslation | null>(initialRecord ?? null);
  const [versionBase, setVersionBase] = useState<LocalTranslation | null>(initialRecord ?? null);
  const [resultExpanded, setResultExpanded] = useState(true);
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [translationFailed, setTranslationFailed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [streamText, setStreamText] = useState("");
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const [earlyDictionary, setEarlyDictionary] = useState<TranslationDictionary | null>(null);
  const [autoAnalysis, setAutoAnalysis] = useState(true);
  const [pendingAnalysis, setPendingAnalysis] = useState<TranslationLearning["analysis"]>();
  const [translationWorking, setTranslationWorking] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const analysisAttempts = useRef(new Set<string>());
  const [analysisWorking, setAnalysisWorking] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [comparisonPaused, setComparisonPaused] = useState(false);
  const [comparisonStopKey, setComparisonStopKey] = useState(0);
  const [analysisModel, setAnalysisModel] = useState<TranslationAnalysisInput["model"]>(initialRecord?.learning?.analysis.model ?? "qwen");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsId = useId();
  const pronunciationText = record ? record.sourceLanguage === "en" ? record.text : record.translatedText : languages.sourceLanguage === "en" ? text : "";
  const speech = useTranslationSpeech(pronunciationText, active && resultExpanded);
  const analysisStopped = useRef(false);
  const translationController = useRef<AbortController | null>(null);
  const controller = useRef<AbortController | null>(null);
  const analysisController = useRef<AbortController | null>(null);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef(0);
  const mounted = useRef(true);
  const started = useRef(false);
  const busy = useRef(false);
  const collected = !!accountId && record?.savedBy === accountId;
  const notifyRef = useRef(onChange);
  useEffect(() => { notifyRef.current = onChange; }, [onChange]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); analysisController.current?.abort(); if (progressTimer.current) clearTimeout(progressTimer.current); };
  }, []);
  useEffect(() => {
    if (!change) return;
    let live = true;
    void Promise.resolve().then(() => {
      if (!live) return;
      if (change.kind === "remove") setVersionBase(current => current?.id === change.record.id ? null : current);
      setRecord(current => {
        if (current?.id !== change.record.id) return current;
        if (change.kind === "remove") return null;
        return { ...current, savedBy: change.record.savedBy, learning: change.record.learning ?? current.learning };
      });
    });
    return () => { live = false; };
  }, [change]);

  const applyLearning = useCallback(async (target: LocalTranslation, patch: Partial<TranslationLearning>, revision: number, signal?: AbortSignal) => {
    if (signal?.aborted || !mounted.current || request.current !== revision) return;
    const saved = await client.enrich(target.savedBy === accountId ? target : { ...target, savedBy: undefined }, patch, signal);
    if (signal?.aborted || !mounted.current || request.current !== revision) return;
    if (!saved.localSaveFailed) notifyRef.current?.({ kind: "update", record: saved });
    setRecord(current => current?.id !== target.id ? current : { ...current, ...(saved.localSaveFailed ? { localSaveFailed: true as const } : {}), learning: {
      dictionary: { status: "notRequested" }, analysis: { status: "notRequested", model: "qwen" }, ...current.learning, ...patch,
    } });
    if (saved.localSaveFailed) setError(getText("translation.storageFailed"));
  }, [client, accountId]);

  const fillDictionary = useCallback(async (target: LocalTranslation, revision: number, signal: AbortSignal, prepared?: Promise<TranslationDictionary>) => {
    try {
      const dictionary = await (prepared ?? client.dictionary(target.text, signal));
      if (!signal.aborted) await applyLearning(target, { dictionary }, revision, signal);
    } catch (failure) {
      if (!signal.aborted) { await applyLearning(target, { dictionary: { status: "unavailable" } }, revision, signal); if (mounted.current && request.current === revision && failure instanceof Error && ["signedOut", "rateLimited"].includes(failure.message)) setError(errorText(failure, "failed")); }
    } finally { if (mounted.current && request.current === revision && controller.current?.signal === signal) setDictionaryLoading(false); }
  }, [client, applyLearning]);

  useEffect(() => {
    if (!initialRecord || initialRecord.learning && !["notRequested", "unavailable"].includes(initialRecord.learning.dictionary.status)) return;
    let live = true;
    const abort = new AbortController();
    void Promise.resolve().then(() => {
      if (!live) return;
      controller.current = abort; setDictionaryLoading(true);
      void fillDictionary(initialRecord, request.current, abort.signal);
    });
    return () => { live = false; abort.abort(); };
  }, [initialRecord, fillDictionary]);

  const cancelCurrent = useCallback(() => {
    analysisStopped.current = true;
    setTranslationFailed(false);
    setComparisonPaused(true); setComparisonStopKey(value => value + 1);
    if (record && working) analysisAttempts.current.add(`${record.id}:${analysisModel}`);
    setAnalysisText("");
    request.current += 1;
    controller.current?.abort(); analysisController.current?.abort();
    if (progressTimer.current) { clearTimeout(progressTimer.current); progressTimer.current = null; }
    busy.current = false; setWorking(false); setDictionaryLoading(false); setAnalysisWorking(false); setAnalysisError(""); setStreamText(""); setEarlyDictionary(null); setPendingAnalysis(undefined); setTranslationWorking(false);
  }, [record, working, analysisModel]);

  function stopTranslation() {
    translationController.current?.abort();
    setTranslationWorking(false); setTranslationFailed(false);
  }
  function stopAnalysis() {
    analysisStopped.current = true;
    analysisController.current?.abort(); analysisController.current = null;
    setAnalysisWorking(false); setAnalysisError("");
  }
  useEffect(() => {
    let live = true;
    if (!active) {
      controller.current?.abort(); analysisController.current?.abort();
      void Promise.resolve().then(() => { if (live) cancelCurrent(); });
    }
    return () => { live = false; };
  }, [active, cancelCurrent]);

  const generate = useCallback(async (retryTranslation = false) => {
    if (!active || !modelReady || savingModel || !languagesReady || savingLanguages || busy.current || !text.trim()) return;
    controller.current?.abort(); analysisController.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    if (!retryTranslation) { setComparisonPaused(false); setComparisonStopKey(value => value + 1); }
    setTranslationFailed(false);
    busy.current = true;
    const revision = ++request.current;
    const translationAbort = new AbortController(); translationController.current = translationAbort;
    const analysisAbort = new AbortController(); analysisController.current = analysisAbort;
    analysisStopped.current = false;
    setWorking(true); setError(""); setNotice(""); setRecord(null); setStreamText(""); if (!retryTranslation) { setEarlyDictionary(null); setPendingAnalysis(undefined); setAnalysisError(""); }
    let created = false;
    try {
      const next = await generateTranslationTogether(client, { text: text.trim(), ...languages, model, previousVersionId: versionBase?.localSaveFailed ? undefined : versionBase?.id, ...source, originalText: source.originalText || text.trim() }, abort.signal, autoAnalysis ? analysisModel : undefined, progress => {
        if (!mounted.current || request.current !== revision || abort.signal.aborted) return;
        if (progress.record) {
          setRecord(progress.record); if (!progress.record.localSaveFailed) setVersionBase(progress.record);
          if (progress.record.localSaveFailed) setError(getText("translation.storageFailed"));
          else { notifyRef.current?.({ kind: created ? "update" : "create", record: progress.record }); created = true; }
        }
        if (progress.text !== undefined) setStreamText(progress.text);
        if (progress.translationWorking !== undefined) setTranslationWorking(progress.translationWorking);
        if (progress.dictionary !== undefined) setEarlyDictionary(progress.dictionary);
        if (progress.dictionaryLoading !== undefined) setDictionaryLoading(progress.dictionaryLoading);
        if (progress.analysis !== undefined) setPendingAnalysis(progress.analysis);
        if (progress.analysisWorking !== undefined) setAnalysisWorking(progress.analysisWorking);
        if (progress.analysisText !== undefined) setAnalysisText(progress.analysisText);
        if (progress.analysisError) setAnalysisError(errorText(progress.analysisError, "analysisUnavailable"));
        if (progress.translationError) { setTranslationFailed(true); setError(errorText(progress.translationError, "failed")); }
      }, retryTranslation ? { dictionary: earlyDictionary ?? { status: "notRequested" }, analysis: pendingAnalysis ?? { status: "notRequested", model: analysisModel } } : undefined, { translation: translationAbort.signal, analysis: analysisAbort.signal });
      if (next.learning?.analysis.status === "unavailable") analysisAttempts.current.add(`${next.id}:${analysisModel}`);
    } catch (failure) { if (mounted.current && revision === request.current && !abort.signal.aborted && !translationAbort.signal.aborted) { setTranslationFailed(true); setError(errorText(failure, "failed")); } }
    finally {
      if (mounted.current && revision === request.current) { busy.current = false; setWorking(false); setTranslationWorking(false); setAnalysisWorking(false); setDictionaryLoading(false); if (analysisController.current === analysisAbort) analysisController.current = null; }
    }
  }, [active, text, model, languages, source, client, autoAnalysis, analysisModel, modelReady, savingModel, languagesReady, savingLanguages, versionBase, earlyDictionary, pendingAnalysis]);

  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => {
      if (live && active && modelReady && languagesReady && autoTranslate && initial?.text && !started.current) { started.current = true; void generate(); }
    });
    // Auto-translation belongs to the initial selection; editing uses the explicit action.
    return () => { live = false; };
  }, [active, autoTranslate, initial?.text, generate, languagesReady, modelReady]);
  async function analyze(fresh = false) {
    if (!record || working || analysisWorking || analysisController.current && !analysisController.current.signal.aborted) return;
    analysisController.current?.abort();
    analysisStopped.current = false;
    const abort = new AbortController(); analysisController.current = abort;
    const revision = request.current;
    setAnalysisWorking(true); setAnalysisError(""); setAnalysisText(""); setPendingAnalysis(undefined);
    analysisAttempts.current.add(`${record.id}:${analysisModel}`);
    try {
      const analysis = await client.analyze({ text: record.text, sourceLanguage: record.sourceLanguage, targetLanguage: record.targetLanguage, model: analysisModel }, abort.signal, value => { if (!abort.signal.aborted && mounted.current && request.current === revision) setAnalysisText(value); }, fresh);
      if (!abort.signal.aborted) {
        await applyLearning(record, { analysis }, revision, abort.signal);
        analysisAttempts.current.delete(`${record.id}:${analysisModel}`);
      }
    } catch (failure) {
      if (!abort.signal.aborted && mounted.current && request.current === revision) setAnalysisError(failure instanceof Error && ["signedOut", "rateLimited"].includes(failure.message) ? errorText(failure, "failed") : getText("translation.analysisUnavailable"));
    } finally { if (mounted.current && request.current === revision && analysisController.current === abort) { analysisController.current = null; setAnalysisWorking(false); } }
  }
  useEffect(() => {
    if (analysisStopped.current || !active || !autoAnalysis || !record || working || analysisWorking || analysisAttempts.current.has(`${record.id}:${analysisModel}`)) return;
    if (record.learning?.analysis.status === "available" && record.learning.analysis.model === analysisModel) return;
    void analyze();
  });
  function retryDictionary() {
    if (!record || working || dictionaryLoading) return;
    if (!controller.current || controller.current.signal.aborted) controller.current = new AbortController();
    setEarlyDictionary(null); setDictionaryLoading(true); void fillDictionary(record, request.current, controller.current.signal);
  }
  async function collect() {
    if (!record || saving) return;
    const selectedId = record.id;
    setSaving(true); setError("");
    try {
      const saved = await client.collect(record);
      notifyRef.current?.({ kind: "collect", record: saved });
      if (mounted.current) setRecord(current => current?.id === selectedId ? { ...current, savedBy: saved.savedBy } : current);
    } catch (failure) { if (mounted.current) setError(errorText(failure, "saveFailed")); }
    finally { if (mounted.current) setSaving(false); }
  }
  function selectVersion(item: LocalTranslation) {
    cancelCurrent(); analysisStopped.current = false; setComparisonPaused(false); setText(item.text); setModel(item.model); restoreLanguage(item.sourceLanguage); setRecord(item); setVersionBase(item);
    setSource({ originalText: item.originalText, sourceUrl: item.sourceUrl, pageTitle: item.pageTitle });
    setAnalysisModel(item.learning?.analysis.model ?? "qwen"); setError(""); setNotice("");
  }
  return <div className="translation-workspace">
    <section className="translation-editor">
      <header className="translation-controls">
        <SelectField label={getText("translation.sourceLanguage")} value={languages.sourceLanguage} disabled={!languagesReady || savingLanguages} onChange={event => { cancelCurrent(); const sourceLanguage = event.target.value as TranslationInput['sourceLanguage']; void setLanguages(sourceLanguage).catch(() => setError(getText("translation.saveFailed"))); setRecord(null); }}><option value="en">{getText("client.languageEn")}</option><option value="zh">{getText("client.languageZh")}</option></SelectField>
        <Button variant="ghost" size="icon" disabled={!languagesReady || savingLanguages} aria-label={getText("translation.swapLanguages")} title={getText("translation.swapLanguages")} onClick={() => { cancelCurrent(); setRecord(null); setNotice(""); void setLanguages(languages.targetLanguage).catch(() => setError(getText("translation.saveFailed"))); }}><ArrowLeftRight size={18} aria-hidden="true" /></Button>
        <SelectField label={getText("translation.targetLanguage")} value={languages.targetLanguage} disabled={!languagesReady || savingLanguages} onChange={event => { cancelCurrent(); const targetLanguage = event.target.value as TranslationInput['targetLanguage']; void setLanguages(targetLanguage === "en" ? "zh" : "en").catch(() => setError(getText("translation.saveFailed"))); setRecord(null); }}><option value="en">{getText("client.languageEn")}</option><option value="zh">{getText("client.languageZh")}</option></SelectField>

        <Button variant="ghost" size="icon" className="translation-settings-toggle" aria-label={getText("settings.shortLabel")} title={getText("settings.shortLabel")} aria-expanded={settingsOpen} aria-controls={settingsId} onClick={() => setSettingsOpen(value => !value)}><SlidersHorizontal size={18} /></Button>
      </header>
      <TranslationSettings id={settingsId} hidden={!settingsOpen} model={model} modelDisabled={!modelReady || savingModel || working || analysisWorking} onModel={value => { cancelCurrent(); void selectModel(value); setRecord(null); setNotice(""); }} analysisModel={analysisModel} analysisDisabled={working || analysisWorking} onAnalysisModel={value => { analysisStopped.current = false; setAnalysisModel(value); }} autoAnalysis={autoAnalysis} onAutoAnalysis={value => { analysisStopped.current = !value; setAutoAnalysis(value); }} speech={speech} />
      <div className="translation-input">
        <TextareaField labelHidden lang={languages.sourceLanguage === "en" ? "en" : "zh-CN"} label={getText("translation.original")} value={text} rows={3} maxLength={10000} onChange={event => { cancelCurrent(); setText(event.target.value); setRecord(null); setNotice(""); }} />
        <Button variant="ghost" size="icon" className="translation-input-clear" disabled={!text || saving} aria-label={getText("translation.clearInput")} title={getText("translation.clearInput")} onClick={() => { cancelCurrent(); setText(""); setRecord(null); setVersionBase(null); setError(""); setNotice(""); }}><X size={16} aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" className="translation-input-copy" disabled={!text} aria-label={getText("translation.copy")} title={getText("translation.copy")} onClick={() => { void navigator.clipboard.writeText(text).then(() => setNotice(getText("translation.copied"))).catch(() => setError(getText("translation.copyFailed"))); }}><Copy size={16} aria-hidden="true" /></Button>
        <div className="translation-input-footer">
        {(record ?? versionBase) && !(record ?? versionBase)!.localSaveFailed && <TranslationVersions record={(record ?? versionBase)!} client={client} disabled={!modelReady || savingModel || saving || savingLanguages} onSelect={selectVersion} />}
        <Button className="translation-input-action" disabled={!modelReady || savingModel || !languagesReady || savingLanguages || !translationWorking && (working || analysisWorking || !text.trim())} onClick={() => translationWorking ? stopTranslation() : void generate()}>
          {translationWorking ? <Square size={16} aria-hidden="true" /> : <Languages size={16} aria-hidden="true" />}
          {getText(translationWorking ? "translation.stopAction" : "translation.translateAction")}
        </Button>
        </div>
      </div>
      {modelPreferenceFailed && <p role="alert" className="translation-error">{getText("translation.saveFailed")}</p>}
      {error && <p role="alert" className="translation-error">{error}{translationFailed && <Button variant="ghost" size="icon" disabled={working || saving} aria-label={getText("translation.retry")} title={getText("translation.retry")} onClick={() => void generate(true)}><RefreshCw size={15} /></Button>}</p>}
      {!!(record || streamText || working || pendingAnalysis || earlyDictionary?.status === "available") && <TranslationResultToggle
        onExpandedChange={setResultExpanded}
        status={record && !record.localSaveFailed && <span className="translation-tag">{getText(collected ? "translation.saved" : "translation.local")}</span>}
        actions={<>
          {onDiscuss && <Button variant="ghost" size="icon" aria-label={getText("translation.conversationOpen")} title={getText("translation.conversationOpen")} disabled={!record || !accountId} onClick={() => { if (record) onDiscuss(record); }}><MessageCircle size={15} aria-hidden="true" /></Button>}
          <Button variant="ghost" size="icon" aria-label={getText("translation.copy")} title={getText("translation.copy")} disabled={!record} onClick={() => { if (record) void navigator.clipboard.writeText(record.translatedText).then(() => setNotice(getText("translation.copied"))).catch(() => setError(getText("translation.copyFailed"))); }}><Copy size={15} aria-hidden="true" /></Button>
          <Button variant="ghost" size="icon" aria-label={getText(collected ? "translation.saved" : "translation.collect")} title={getText(collected ? "translation.saved" : "translation.collect")} className="translation-collect-button" data-collected={collected || undefined} disabled={!record || working || saving || record.localSaveFailed || collected} onClick={() => void collect()}><Star size={15} aria-hidden="true" /></Button>
        </>}>
        {record ? <>
        <div className="translation-reading-block"><p lang={record.targetLanguage === "zh" ? "zh-CN" : "en"}>{record.translatedText}</p></div>
        {record.sourceUrl && <TranslationSourceCard url={record.sourceUrl} title={record.pageTitle} />}
        {record.originalText && record.originalText !== record.text && <TranslationResultToggle title={getText("translation.originalSelection")} defaultExpanded={false} persistExpanded={false}><p>{record.originalText}</p></TranslationResultToggle>}

        </> : <>
        <div aria-busy={working}>
        <div className="translation-reading-block">{translationWorking ? <GenerationState label={getText("translation.translating")} text={streamText} lang={languages.targetLanguage === "zh" ? "zh-CN" : "en"} /> : <p lang={languages.targetLanguage === "zh" ? "zh-CN" : "en"}>{streamText}</p>}</div>
        {earlyDictionary?.status === "available" && earlyDictionary.entries.map((entry, index) => <div className="translation-phonetics" key={`${entry.word}-${index}`}><strong lang="en">{entry.word}</strong>{entry.phonetics.map(value => <span lang="en" key={value}>{value}</span>)}</div>)}
        </div>
        </>}
        <TranslationLearningContent busy={working || dictionaryLoading || saving} active={active && resultExpanded} record={record ?? undefined} sourceText={text} sourceLanguage={languages.sourceLanguage} pendingAnalysis={pendingAnalysis} pendingDictionary={earlyDictionary ?? undefined} dictionaryLoading={dictionaryLoading} analysisWorking={analysisWorking} analysisModel={analysisModel} speech={speech} onStopAnalysis={stopAnalysis} onAnalyze={() => void analyze(true)} onDictionaryRetry={!working ? retryDictionary : undefined} analysisError={analysisError} analysisText={analysisText}>
        <TranslationComparison input={{ text: record?.text ?? text, sourceLanguage: record?.sourceLanguage ?? languages.sourceLanguage, model: analysisModel }} paused={comparisonPaused || !active} stopKey={comparisonStopKey} />
        </TranslationLearningContent>
      </TranslationResultToggle>}
      {notice && <p role="status">{notice}</p>}
    </section>
  </div>;
}
