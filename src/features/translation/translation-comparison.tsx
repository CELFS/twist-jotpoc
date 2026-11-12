import { ErrorNotice } from "@/features/shell/notification-center";

import { generationErrorCode } from '@/translation/generation-error';
import { ChevronDown, ChevronUp, RefreshCw, Square } from 'lucide-react';
import { useId } from 'react';
import { useComparisonLanguages } from './use-comparison-languages';
import { Button } from '@/components/ui/button';
import { GenerationState } from '@/components/ui/generation-state';
import { getText } from '@/i18n/get-text';
import { type ComparisonInput } from '@/translation/comparison-contracts';
import { useTranslationPreference } from './use-translation-preference';
import { useTranslationComparison } from './use-translation-comparison';

const languageKeys = { fr: 'translation.comparisonLanguageFR', es: 'translation.comparisonLanguageES', ru: 'translation.comparisonLanguageRU', ar: 'translation.comparisonLanguageAR' } as const;
export function TranslationComparison({ input, paused = false, stopKey = 0 }: { input: Omit<ComparisonInput, 'language'>; paused?: boolean; stopKey?: number }) {
  const enabled = useTranslationPreference('translation.comparisonEnabled');
  const expanded = useTranslationPreference('translation.comparisonExpanded', true);
  const languages = useComparisonLanguages();
  const generation = useTranslationComparison(input, enabled.ready && enabled.value && languages.ready, paused, stopKey, languages.value);
  const bodyId = useId();
  return <section className="translation-learning-section translation-comparison">
    <header className="translation-comparison-heading">
      <strong>{getText('translation.comparisonTitle')}</strong>
      {enabled.value && <Button variant="ghost" size="icon" aria-label={getText(generation.working ? 'translation.stopAction' : 'translation.comparisonGenerate')} title={getText(generation.working ? 'translation.stopAction' : 'translation.comparisonGenerate')} onClick={() => generation.working ? generation.stop() : generation.start(true)}>{generation.working ? <Square size={15} /> : <RefreshCw size={15} />}</Button>}
      <Button variant="ghost" size="icon" aria-label={getText('translation.comparisonTitle')} aria-expanded={expanded.value} aria-controls={bodyId} disabled={!expanded.ready || expanded.saving} onClick={() => void expanded.toggle()}>{expanded.value ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</Button>
    </header>
    {(enabled.failed || expanded.failed || languages.failed) && <ErrorNotice text={getText('translation.saveFailed')} />}
    <div id={bodyId} hidden={!enabled.value || !expanded.value}>
      <div className="translation-comparison-list">
        {languages.value.map(language => {
          const card = generation.cards[language];
          const errorKey = generationErrorCode(card?.error) ? `translation.${generationErrorCode(card?.error)!}` as const : card?.error === 'signedOut' ? 'translation.signedOut' : card?.error === 'rateLimited' ? 'translation.rateLimited' : 'translation.failed';
          return <article className="translation-learning-section translation-comparison-item" key={language}>
            <h4 className="translation-language-tag">{getText(languageKeys[language])}</h4>
            {!card?.working && card?.text && !card.result && <GenerationState working={false} label={getText("translation.partialResponse")} text={card.text} />}
            {card?.working ? <GenerationState label={getText('translation.comparisonGenerating')} text={card.text} /> : card?.result ? <>
              <p lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}>{card.result.translatedText}</p>
              <p className="translation-comparison-grammar" lang="zh-CN" dir="ltr">{card.result.grammar}</p>
            </> : <div>{card?.error ? <ErrorNotice text={getText(errorKey)} /> : <p>{getText('translation.comparisonReady')}</p>}{card?.error && <Button variant="ghost" size="icon" aria-label={`${getText('translation.retry')}: ${getText(languageKeys[language])}`} title={getText('translation.retry')} onClick={() => generation.retry(language)}><RefreshCw size={15} /></Button>}</div>}
          </article>;
        })}
      </div>
    </div>
  </section>;
}
