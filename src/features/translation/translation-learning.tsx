import { LoadingState } from "@/components/ui/loading-state";

import { type ReactNode } from "react";
import { GenerationState } from "@/components/ui/generation-state";
import { RefreshCw, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getText } from "@/i18n/get-text";
import { translationModels, type TranslationAnalysisInput, type TranslationRecord, type TranslationLearning } from "@/translation/contracts";
import { useTranslationSpeech } from "./translation-speech";
import { TranslationResultToggle } from "./translation-result-toggle";
import { TranslationPronunciation } from "./translation-pronunciation";
import { TranslationVocabulary } from "./translation-vocabulary";
import { TranslationAnalysisProgress } from "./translation-analysis-progress";

export function TranslationLearningContent({ children, record, sourceText = "", sourceLanguage = "en", pendingAnalysis, pendingDictionary, active = true, busy = false, dictionaryLoading = false, analysisWorking = false, analysisModel = "qwen", speech: sharedSpeech, onStopAnalysis, onAnalyze, onDictionaryRetry, analysisError, analysisText }: {
  children?: ReactNode; record?: TranslationRecord; sourceText?: string; sourceLanguage?: "en" | "zh"; pendingAnalysis?: TranslationLearning["analysis"]; pendingDictionary?: TranslationLearning["dictionary"]; active?: boolean; busy?: boolean; dictionaryLoading?: boolean; analysisWorking?: boolean;
  analysisModel?: TranslationAnalysisInput["model"]; speech?: ReturnType<typeof useTranslationSpeech>; onStopAnalysis?: () => void;
  onAnalyze?: () => void; onDictionaryRetry?: () => void; analysisError?: string; analysisText?: string;
}) {
  const pronunciationText = record ? record.sourceLanguage === "en" ? record.text : record.translatedText : sourceLanguage === "en" ? sourceText : "";
  const localSpeech = useTranslationSpeech(pronunciationText, active && !sharedSpeech);
  const speech = sharedSpeech ?? localSpeech;
  const dictionary = pendingDictionary ?? record?.learning?.dictionary;
  const analysis = pendingAnalysis ?? record?.learning?.analysis;
  const read = (text: string) => <Button variant="ghost" size="icon" disabled={!speech.selected || !active} aria-label={getText("translation.readAloud")} title={getText("translation.readAloud")} onClick={() => speech.speak(text)}><Volume2 size={15} /></Button>;
  return <div className="translation-learning">
    <TranslationPronunciation text={pronunciationText} dictionary={dictionary} active={active} speech={speech} />
    {(analysis || onAnalyze) && <TranslationResultToggle className="translation-learning-section translation-analysis" title={getText("translation.aiAnalysis")} model={translationModels[analysisWorking ? analysisModel : analysis?.status === "available" ? analysis.model : analysisModel]} persistExpanded={false}
>
      {onAnalyze && <div className="translation-analysis-controls">
        <Button variant="secondary" disabled={analysisWorking ? !onStopAnalysis : !record || busy} onClick={analysisWorking ? onStopAnalysis : onAnalyze}>{analysisWorking && <Square size={14} />}{getText(analysisWorking ? "translation.stopAction" : analysisError || analysis?.status === "unavailable" ? "translation.retry" : analysis?.status === "available" ? "translation.regenerateAnalysis" : "translation.analyzeAction")}</Button>
      </div>}
      {analysisError && <p role="alert" className="translation-error">{analysisError}{onAnalyze && <Button variant="ghost" size="icon" disabled={!record || busy || analysisWorking} aria-label={getText("translation.retry")} title={getText("translation.retry")} onClick={onAnalyze}><RefreshCw size={15} /></Button>}</p>}
      {!analysisWorking && analysisText && analysis?.status !== "available" && <GenerationState working={false} label={getText("translation.partialResponse")} text={analysisText} lang="zh-CN" />}
      {analysisWorking ? <TranslationAnalysisProgress text={analysisText} /> : analysis?.status === "available" ? <>
        <TranslationVocabulary items={analysis.content.vocabulary} />
        {(analysis.content.explanation || analysis.content.english?.explanation || !!analysis.content.usage.length || !!analysis.content.english?.usage.length) && <div className="translation-reading-block">
        {analysis.content.explanation && <p lang="zh-CN">{analysis.content.explanation}</p>}
        {analysis.content.english?.explanation && <p lang="en">{analysis.content.english.explanation}</p>}
        {!!analysis.content.usage.length && <><h4>{getText("translation.usage")}</h4><ul>{analysis.content.usage.map((note, index) => <li key={index} lang="zh-CN">{note}</li>)}</ul></>}
        {!!analysis.content.english?.usage.length && <ul>{analysis.content.english.usage.map((note, index) => <li key={index} lang="en">{note}</li>)}</ul>}
        </div>}
        {!!analysis.content.examples.length && <><h4>{getText("translation.aiExamples")}</h4>{analysis.content.examples.map((example, index) => <blockquote key={index}><p lang="en">{example.text}{read(example.text)}</p><p lang="zh-CN">{example.translation}</p></blockquote>)}</>}
      </> : !analysisWorking && !analysisError && <p className="translation-hint">{getText(analysis?.status === "unavailable" ? "translation.analysisUnavailable" : "translation.analysisOnDemand")}</p>}
    </TranslationResultToggle>}
    {children}
    {(dictionary || dictionaryLoading) && <TranslationResultToggle className="translation-learning-section translation-dictionary" title={getText("translation.dictionary")} defaultExpanded={false} persistExpanded={false}>
      {dictionaryLoading && <LoadingState compact rows={1} label={getText("translation.dictionaryLoading")} />}
      {dictionary?.status === "available" ? <>
        {dictionary.entries.map((entry, index) => <div className="translation-dictionary-entry" key={`${entry.word}-${index}`}>
          <div className="translation-phonetics"><strong lang="en">{entry.word}</strong>{read(entry.word)}</div>
          {entry.meanings.map((meaning, meaningIndex) => <div key={`${meaning.partOfSpeech}-${meaningIndex}`}><span className="translation-model" lang="en">{meaning.partOfSpeech}</span><ol>{meaning.definitions.map((definition, definitionIndex) => <li key={definitionIndex}><p lang="en">{definition.definition}</p>{definition.example && <blockquote><span className="translation-tag">{getText("translation.dictionaryExample")}</span><p lang="en">{definition.example}{read(definition.example)}</p></blockquote>}</li>)}</ol></div>)}
          <footer className="translation-attribution"><a href={dictionary.url} target="_blank" rel="noopener noreferrer">{dictionary.provider}</a>{entry.sourceUrls.map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{getText("translation.entrySource")}</a>)}{entry.license && <a href={entry.license.url} target="_blank" rel="noopener noreferrer">{entry.license.name}</a>}</footer>
        </div>)}
      </> : !dictionaryLoading && dictionary && <p className="translation-hint">{getText(dictionary.status === "unsupported" ? "translation.dictionaryWordOnly" : dictionary.status === "notFound" ? "translation.dictionaryNotFound" : dictionary.status === "notRequested" ? "translation.dictionaryNotRequested" : "translation.dictionaryUnavailable")}</p>}
      {!dictionaryLoading && dictionary?.status === "unavailable" && onDictionaryRetry && <Button variant="secondary" onClick={onDictionaryRetry}>{getText("translation.retryDictionary")}</Button>}
    </TranslationResultToggle>}
  </div>;
}
