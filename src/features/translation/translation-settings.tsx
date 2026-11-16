import { ErrorNotice } from "@/features/shell/notification-center";

import { SelectField } from "@/components/ui/select-field";
import { AssistantModelIcon } from "@/features/assistant/assistant-model-icon";
import { Switch } from "@/components/ui/switch";
import { TagMultiSelect } from "@/components/ui/tag-multi-select";
import { getText } from "@/i18n/get-text";
import { translationModels, type TranslationInput, type TranslationAnalysisInput } from "@/translation/contracts";
import { comparisonLanguages } from "@/translation/comparison-contracts";
import { useComparisonLanguages } from "./use-comparison-languages";
import { useTranslationPreference } from "./use-translation-preference";
import type { useTranslationSpeech } from "./translation-speech";

const modelVisuals = Object.fromEntries(Object.keys(translationModels).map(model => [model, <AssistantModelIcon key={model} model={model} />]));
const languageKeys = { fr: 'translation.comparisonLanguageFR', es: 'translation.comparisonLanguageES', ru: 'translation.comparisonLanguageRU', ar: 'translation.comparisonLanguageAR' } as const;
export function TranslationSettings({ id, hidden, model, onModel, modelDisabled, analysisModel, onAnalysisModel, analysisDisabled, autoAnalysis, onAutoAnalysis, speech }: {
  id: string; hidden: boolean; model?: TranslationInput['model']; onModel?: (model: TranslationInput['model']) => void; modelDisabled?: boolean;
  analysisModel: TranslationAnalysisInput['model']; onAnalysisModel(model: TranslationAnalysisInput['model']): void; analysisDisabled?: boolean;
  autoAnalysis?: boolean; onAutoAnalysis?: (value: boolean) => void; speech: ReturnType<typeof useTranslationSpeech>;
}) {
  const comparison = useTranslationPreference('translation.comparisonEnabled');
  const languages = useComparisonLanguages();
  return <section id={id} hidden={hidden} className="translation-settings" aria-label={getText('settings.shortLabel')}>
    {onModel && model && <SelectField optionVisuals={modelVisuals} label={getText('translation.model')} value={model} disabled={modelDisabled} onChange={event => onModel(event.target.value as TranslationInput['model'])}>{Object.entries(translationModels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>}
    <div className="translation-settings-group">
      {onAutoAnalysis && <div className="translation-settings-heading">
        <span className="ui-field-label">{getText('translation.analysisModel')}</span>
        <Switch label={getText('translation.autoAnalysis')} checked={!!autoAnalysis} onCheckedChange={onAutoAnalysis} />
      </div>}
      <SelectField optionVisuals={modelVisuals} labelHidden={!!onAutoAnalysis} label={getText('translation.analysisModel')} value={analysisModel} disabled={analysisDisabled} onChange={event => onAnalysisModel(event.target.value as TranslationAnalysisInput['model'])}>{(['qwen', 'qwen35'] as const).map(value => <option key={value} value={value}>{translationModels[value]}</option>)}</SelectField>
    </div>
    {onModel && <div className="translation-settings-group">
      <div className="translation-settings-heading">
        <span className="ui-field-label">{getText('translation.comparisonTitle')}</span>
        <Switch label={getText('translation.comparisonTitle')} checked={comparison.value} disabled={!comparison.ready || comparison.saving} onCheckedChange={() => void comparison.toggle()} />
      </div>
      <TagMultiSelect label={getText('translation.comparisonLanguages')} expandLabel={getText('translation.expandLanguages')} collapseLabel={getText('translation.collapseLanguages')} removeLabel={label => `${getText('translation.removeLanguage')}: ${label}`} options={comparisonLanguages.map(value => ({ value, label: getText(languageKeys[value]) }))} value={languages.value} minSelected={1} disabled={!languages.ready || languages.saving} onChange={value => void languages.change(value)} />
    </div>}
    {speech.voices.length ? <SelectField label={getText('translation.voice')} value={speech.voiceId} onChange={event => speech.setVoiceId(event.target.value)}>{speech.voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}{voice.localService ? ` · ${getText('translation.localVoice')}` : ''}</option>)}</SelectField> : <p className="translation-hint">{getText('translation.speechUnavailable')}</p>}
    {(comparison.failed || languages.failed) && <ErrorNotice text={getText('translation.saveFailed')} />}
  </section>;
}
